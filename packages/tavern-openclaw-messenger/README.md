# OpenClaw Tavern Messenger

`@zknicker/tavern-openclaw-messenger` is the first-party OpenClaw channel plugin for Tavern chats.

Install this package into an OpenClaw Gateway, then configure Tavern with that Gateway. Tavern uses
the relay only to ask OpenClaw to run a Tavern message. Tavern state writes go through
`@tavern/sdk` and the Tavern API:

```txt
Tavern Runtime chat server
  -> Tavern Runtime /chat
  -> Tavern Messenger inbound-message
  -> Tavern Messenger channel turn
  -> OpenClaw agent/session execution
  -> OpenClaw shared message lifecycle
  -> Tavern Messenger text delivery
  -> @tavern/sdk
  -> Tavern API
```

The plugin accepts plain text and Tavern-owned message metadata, such as tool mentions, and passes
that metadata into the channel turn context.

The managed Tavern channel scope is intentionally small:

- one Tavern chat has one bound OpenClaw agent
- text-only sends
- single-threaded, long-lived chats
- no ACP and no generic `sessions.send` route

The plugin does not store dynamic Tavern chat registrations and does not expose Tavern-specific
Gateway RPCs for chat management or turn start. Tavern Runtime owns chat existence, bindings, and
labels in Tavern's runtime database. The plugin adapts OpenClaw turn signals into Tavern API
deliveries and activity.

## Architecture Principles

- Tavern Runtime is the chat server. OpenClaw is the runtime. The plugin is the native channel
  contract between them.
- Tavern chat identity is the durable `cht_` id. Do not derive it from the sender, label, delivery
  metadata, or a prefixed variant.
- Tavern Runtime owns Tavern channel registration. The plugin owns channel turn intake after
  Runtime delivers an `inbound-message` frame, then writes Tavern state through `@tavern/sdk`.
- OpenClaw core owns the shared `message` tool and final reply send lifecycle. The plugin exposes
  a Tavern channel `message` adapter and implements only the Tavern-native text delivery side
  effect.
- Session keys come from OpenClaw's channel routing. Tavern sends with the synced session key,
  not derive session keys from chat ids or delivery metadata.
- Runtime history remains OpenClaw-owned execution evidence. Tavern Runtime owns canonical chat
  history, and the plugin must not create a second durable timeline.
- Bad identity is a hard failure. Do not recover Tavern chat identity from labels, origin strings,
  delivery metadata, or stale local records.

## Session Model

Tavern chats are first-party, durable chat containers. In OpenClaw terms, each Tavern chat is its
own session for the bound agent. The plugin must not route Tavern chat traffic through the agent's
shared `main` session.

The OpenClaw route is intentionally:

```txt
chatType: channel
peer.kind: channel
peer.id: <tavern-chat-id>
to: chat:<tavern-chat-id>
```

That keeps Tavern chat semantics aligned with OpenClaw's channel-scoped session routing. The
expected session key shape is:

```txt
agent:<agent-id>:tavern:channel:<tavern-chat-id>
```

Do not change this to `chatType: direct` or `peer.kind: direct`. OpenClaw's default direct-message
scope can collapse direct routes to `agent:<agent-id>:main`, which means Tavern would be sending into
the agent's main session instead of the selected Tavern chat.

## Data Flow

```txt
Tavern app
  creates/selects a Tavern chat
  sends text for the selected session key
        |
        v
Tavern Runtime chat server
  validates one bound agent
  persists the message and relays the turn
        |
        v
Tavern Runtime
  forwards an inbound-message frame over /chat
  stores runtime channel ingress and accepted-message receipts
        |
        v
Tavern Messenger plugin
  validates chat + agent + expected session key
  dispatches the OpenClaw channel turn
  delivers final replies through the channel message adapter
  writes delivery/activity through @tavern/sdk
        |
        v
Tavern API + OpenClaw session
  agent:<agent-id>:tavern:channel:<tavern-chat-id>
```

## OpenClaw Boundary

Tavern Runtime owns Tavern chats, canonical messages, participants, sequence, and events. It also
manages the OpenClaw process and exposes the private control relay that carries accepted Tavern
messages into this plugin. OpenClaw core implements agent execution and final reply dispatch
through the plugin's channel `message` adapter. The plugin writes assistant deliveries and live
activity through `@tavern/sdk`, not through custom relay events.

## Gotchas

- `tavern:<uuid>` is not a valid Tavern Messenger chat id.
- `agent:<agent-id>:main` is not a valid Tavern chat session.
- `direct` chat routing is wrong for Tavern chats, even when there is only one user and one agent.
- Tavern sender is message actor metadata, not the OpenClaw session peer.
- Adapter-side cleanup that makes bad OpenClaw records look correct hides integration bugs.
