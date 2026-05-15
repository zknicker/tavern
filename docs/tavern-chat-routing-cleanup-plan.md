# Tavern Chat Routing Cleanup Plan

## Context

Tavern Runtime now manages the local OpenClaw install, process, generated config, and runtime state.
That changes the ownership model for Tavern chats.

Before this cleanup, Tavern Messenger still contained older external-runtime assumptions:

- Tavern creates a chat.
- Tavern calls plugin RPCs such as `tavern.chat.upsert`.
- The plugin stores a durable chat catalog in `tavern-chats.json`.
- The server later syncs that plugin-owned catalog back into Tavern projections.
- Tavern sends turns through an Tavern-specific OpenClaw Gateway RPC, `tavern.turn.start`.

That model is now wrong. It created a second durable source of truth for app chats and allowed stale
global OpenClaw state, such as `~/.openclaw/tavern-chats.json`, to bleed back into managed Tavern
state. The `tavern.turn.start` Gateway RPC is also the wrong long-term boundary: normal channel
plugins receive platform events through their own provider/client layer and enter OpenClaw's channel
turn runtime from inside the plugin.

## Implementation Status

This cleanup has been implemented for the managed Runtime path:

- Tavern Messenger no longer registers chat-management Gateway RPCs.
- Tavern Messenger no longer registers `tavern.turn.start`.
- The plugin no longer has a file-backed chat catalog or `TAVERN_CHAT_STORE_PATH`.
- Runtime sends app messages through the private `/chat` plugin websocket relay.
- OpenClaw Tavern sessions no longer project Tavern chat rows.
- Tavern chat rows come from Tavern-owned create/update/delete flows in Server storage.

## OpenClaw Model To Mimic

Discord, Telegram, and the SDK QA channel do not persist a separate catalog of every conversation in
the channel plugin. They receive an inbound platform event, derive route facts from that event, and
run the channel turn.

Important OpenClaw channel concepts:

- `sessionKey` is the durable runtime bucket used for session storage, context, and concurrency.
- The channel turn still needs per-turn route facts such as channel, account, peer, sender, topic,
  thread, and reply target.
- OpenClaw session stores hold session metadata, `sessionId`, last route, and transcripts.
- Platform-specific conversation ids are route facts, not a separate OpenClaw-owned app chat list.
- New channel code should use the plugin SDK message/ingress/turn surfaces:
  `defineChannelMessageAdapter`, channel ingress resolution, and `runtime.channel.turn.*`.
- The external transport between a provider and the channel plugin is platform-owned. OpenClaw
  prescribes the plugin-side adapter boundary, not a public Gateway RPC for each platform message.

Examples from OpenClaw channel routing:

- Telegram group topic: `agent:main:telegram:group:-1001234567890:topic:42`
- Discord channel thread: `agent:main:discord:channel:123456:thread:987654`
- Tavern chat session: `agent:<agentId>:tavern:channel:<tavernChatId>`

The closest bundled source pattern for Tavern is OpenClaw's `qa-channel`: it has a tiny transport
bus with event kinds such as `inbound-message` and `outbound-message`, while the plugin maps those
messages into OpenClaw channel turns internally.

## Target Ownership

Tavern owns app chats.

- Tavern DB owns chat existence, labels, bindings, selected agent, sidebar ordering, and app
  presentation metadata.
- Tavern Server owns durable Tavern storage in `~/.tavern/tavern.sqlite`, including app chats,
  outbox state, projections, and observed reply history.
- Tavern Runtime owns managed OpenClaw install, generated config, process launch, and a minimal
  transport relay to the local Tavern Messenger plugin.
- OpenClaw owns session metadata, transcripts, tool calls, run state, and native runtime behavior.
- Tavern Messenger is an OpenClaw channel plugin. It receives Tavern channel bus events, translates
  inbound messages into OpenClaw channel turns, and delivers outbound messages back to Tavern through
  the same bus.

Tavern Messenger should not own:

- app chat existence
- app chat labels
- app chat bindings
- chat list projection
- a durable chat registry file
- an Tavern-specific public OpenClaw Gateway turn RPC

## Desired Runtime Flow

```txt
Tavern app
  creates/selects an Tavern chat in Tavern DB
  sends text for selected agent
        |
        v
Tavern server
  reads chat + binding from Tavern DB
  derives expected OpenClaw session key
  persists durable outbox/projection state
  sends a minimal Tavern channel bus message to Tavern Runtime
        |
        v
Tavern Runtime
  relays the bus message over its local plugin websocket
  stores no durable chat, transcript, or projection data
        |
        v
Tavern Messenger plugin
  receives an inbound-message event
  maps the message into OpenClaw channel facts
  calls runtime.channel.turn.run or runtime.channel.turn.runAssembled
  sends outbound-message events back through Runtime
        |
        v
OpenClaw session store
  stores session metadata/transcript for sessionKey
```

Runtime also relays plugin acknowledgements and outbound messages back to Tavern Server over the
same configured Runtime connection. Tavern Server persists those results in `~/.tavern/tavern.sqlite`
and emits normal app invalidation events for the UI.

## Planned Changes

### Remove Plugin-Owned Chat Management

Delete these Gateway RPC methods from Tavern Messenger:

- `tavern.chats.list`
- `tavern.chat.upsert`
- `tavern.chat.bindings.replace`
- `tavern.chat.delete`

Delete the file-backed chat registry:

- `packages/tavern-openclaw-messenger/src/chat-store.js`
- `TAVERN_CHAT_STORE_PATH`
- `~/.tavern/runtime/openclaw/run/tavern-chats.json`
- `~/.openclaw/tavern-chats.json`

### Remove `tavern.turn.start`

Delete the Tavern-specific OpenClaw Gateway turn RPC. Tavern ingress should be a private channel bus
between Tavern Server, Tavern Runtime, and the Tavern Messenger plugin, not a public OpenClaw
Gateway method.

The minimal inbound event should look like the SDK QA channel shape:

```ts
type TavernBusEvent =
  | { cursor: number; kind: "inbound-message"; accountId: "default"; message: TavernBusMessage }
  | { cursor: number; kind: "outbound-message"; accountId: "default"; message: TavernBusMessage };

type TavernBusMessage = {
  id: string;
  conversation: {
    id: string;
    kind: "direct" | "group" | "channel";
    title?: string;
  };
  senderId: string;
  senderName?: string;
  text: string;
  timestamp: number;
  threadId?: string;
  replyToId?: string;
};
```

The plugin should validate only deterministic consistency:

- message id and content are valid
- conversation id is a valid Tavern chat id
- configured/bound agent route produces the expected OpenClaw session key
- sender facts are trusted Tavern channel facts, not plugin-owned profile state

The plugin should not validate that the chat exists in a plugin-owned store. Tavern Server owns chat
existence.

### Add Runtime Relay

Tavern Runtime should expose a minimal relay over WebSocket:

- Tavern Messenger plugin opens a local authenticated WebSocket to Runtime.
- Tavern Server uses its configured Runtime connection to send Tavern bus events.
- Runtime forwards bus events between Server and the local plugin.
- Runtime keeps only ephemeral connection and in-flight frame state.
- Runtime does not store chats, transcripts, projections, outbox rows, or reply history.
- If Runtime restarts, Tavern Server resends unacknowledged durable outbox events.

This keeps the customer-facing network surface to one Runtime port. OpenClaw Gateway remains local
and hidden behind Runtime.

### Move Session-Key Derivation To Tavern-Owned Code

Tavern Server should derive and persist the expected OpenClaw session key when it creates or binds a
chat:

```txt
agent:<agentId>:tavern:channel:<tavernChatId>
```

Sending should use the stored session key from Tavern DB. Runtime and plugin code should not repair
or derive alternate session keys from labels, stale projections, or OpenClaw chat records.

### Simplify Runtime Adapter APIs

Runtime adapter behavior should become:

- `postMessage()` appends/sends a durable Tavern bus `inbound-message`.
- Session reads use OpenClaw session APIs by `sessionKey`.
- Chat list reads come from Tavern DB projections, not OpenClaw.
- Binding changes update Tavern DB and generated OpenClaw config only when needed for runtime-owned
  config surfaces.

The adapter should stop depending on plugin chat management methods and plugin Gateway turn methods.

### Keep OpenClaw Session Storage

Do not remove OpenClaw session stores. They are the correct runtime-owned storage for:

- `sessionId`
- `sessionKey`
- transcript file identity
- last route metadata
- tool calls and runtime execution history

The cleanup removes only the duplicate Tavern chat catalog.

## Migration / Reset

For local development after this change:

1. Stop the dev stack.
2. Remove or archive stale plugin chat store files:
   - `~/.openclaw/tavern-chats.json`
   - `~/.tavern/runtime/openclaw/run/tavern-chats.json`
3. Recreate Tavern DB projections from Tavern-owned chat creation flows and OpenClaw session sync.
4. Keep managed OpenClaw npm installs under `~/.tavern/runtime/openclaw/versions`.

No automatic compatibility layer is planned for old plugin chat stores. This is first-party local
state and the correct target design is simpler than preserving the duplicate registry.

## Validation

Add or update focused tests for:

- Tavern Messenger no longer registers `tavern.turn.start`.
- Tavern Messenger no longer registers chat management Gateway RPC methods.
- Tavern Messenger accepts an `inbound-message` bus event and enters `runtime.channel.turn.*`.
- invalid conversation/session key combinations fail before dispatch.
- Tavern server derives `agent:<agentId>:tavern:channel:<chatId>` for app chats.
- sending a message appends/sends only an Tavern bus `inbound-message`.
- Runtime relays Server bus events to the local plugin socket without durable writes.
- Runtime relays plugin `outbound-message` events back to Server.
- resetting `~/.tavern/tavern.sqlite` cannot be repopulated from any plugin-owned chat catalog.
- managed Runtime does not set or depend on `TAVERN_CHAT_STORE_PATH`.

Manual smoke test:

1. Reset local Tavern DB and managed OpenClaw run state.
2. Boot `bun run desktop:dev:runtime`.
3. Confirm chat sidebar starts empty.
4. Create one chat and send one message.
5. Confirm the OpenClaw session appears under the deterministic session key.
6. Restart the stack and confirm only the Tavern DB-created chat returns.
