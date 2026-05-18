---
summary: Tavern Messenger plugin contract for OpenClaw channel package shape, message/turn lifecycle, durable identity, relay frames, tests, and audit gaps.
read_when:
  - changing the Tavern OpenClaw Messenger plugin, relay, activity, or delivery path
  - changing how OpenClaw turns map into Tavern API messages, activity, or events
---

# Tavern OpenClaw Messenger Plugin

Tavern treats OpenClaw as the native execution runtime and Tavern Runtime as
the chat server.

The Tavern Messenger plugin is the bridge between those systems. It is a small,
first-party OpenClaw channel plugin that turns durable Tavern chat messages into
OpenClaw session turns, then streams OpenClaw turn state back to Tavern as
recoverable activity and delivery events.

The goal is boring identity:

* one Tavern chat maps to one OpenClaw session key for an agent
* one accepted Tavern user message has one durable message id
* one OpenClaw turn has one run id
* OpenClaw transcript evidence links back to Tavern messages by stable ids
* websocket events are notifications, not the source of truth

## Source Docs Read

This document is based on the OpenClaw plugin author and maintainer references
read on 2026-05-17:

* Plugin SDK overview: https://docs.openclaw.ai/plugins/sdk-overview
* Plugin SDK subpaths: https://docs.openclaw.ai/plugins/sdk-subpaths
* Entry points: https://docs.openclaw.ai/plugins/sdk-entrypoints
* Runtime helpers: https://docs.openclaw.ai/plugins/sdk-runtime
* Agent harness plugins: https://docs.openclaw.ai/plugins/sdk-agent-harness
* Setup and config: https://docs.openclaw.ai/plugins/sdk-setup
* Testing: https://docs.openclaw.ai/plugins/sdk-testing
* Plugin manifest: https://docs.openclaw.ai/plugins/manifest
* Plugin internals: https://docs.openclaw.ai/plugins/architecture
* Plugin architecture internals: https://docs.openclaw.ai/plugins/architecture-internals
* Migrate to SDK: https://docs.openclaw.ai/plugins/sdk-migration
* Plugin compatibility: https://docs.openclaw.ai/plugins/compatibility
* Channel message API: https://docs.openclaw.ai/plugins/sdk-channel-message
* Channel turn kernel: https://docs.openclaw.ai/plugins/sdk-channel-turn
* Channel ingress API: https://docs.openclaw.ai/plugins/sdk-channel-ingress
* Message presentation: https://docs.openclaw.ai/plugins/message-presentation

## Reference Implementations

Use these as implementation references before changing Tavern Messenger plugin
architecture:

* OpenClaw Discord plugin:
  https://github.com/openclaw/openclaw/tree/main/extensions/discord
* Discord entry point:
  https://github.com/openclaw/openclaw/blob/main/extensions/discord/index.ts
* Discord channel plugin API:
  https://github.com/openclaw/openclaw/blob/main/extensions/discord/channel-plugin-api.ts
* Discord runtime send path:
  https://github.com/openclaw/openclaw/blob/main/extensions/discord/runtime-api.send.ts
* OpenClaw ClickClack plugin:
  https://github.com/openclaw/openclaw/tree/main/extensions/clickclack
* ClickClack entry point:
  https://github.com/openclaw/openclaw/blob/main/extensions/clickclack/index.ts
* ClickClack channel plugin API:
  https://github.com/openclaw/openclaw/blob/main/extensions/clickclack/channel-plugin-api.ts
* ClickClack runtime API:
  https://github.com/openclaw/openclaw/blob/main/extensions/clickclack/runtime-api.ts

## First Principles

OpenClaw plugin code has two planes.

The control plane is cheap metadata. `openclaw.plugin.json` and
`package.json#openclaw` describe identity, channel ownership, setup metadata,
config schemas, install hints, and activation hints before OpenClaw loads the
runtime module.

The data plane is runtime behavior. The plugin entry registers a channel,
services, hooks, methods, and runtime handlers only after OpenClaw deliberately
loads the plugin in the right registration mode.

For Tavern, the data plane is narrow:

1. Maintain the Tavern inbound control relay.
2. Accept Tavern user messages into OpenClaw execution.
3. Run OpenClaw's shared channel turn lifecycle.
4. Write assistant delivery, tool progress, reasoning summaries, failures, and
   completion notices through `@tavern/sdk`.
5. Preserve stable Tavern ids in the OpenClaw transcript mirror.

The plugin does not become a second chat system. Tavern Runtime owns chat
messages, participants, sequence, events, reads, soft deletes, and durable
delivery state. Tavern App owns presentation, optimistic UI, and websocket
clients. OpenClaw owns native execution, session transcripts, tools, provider
and harness policy, and runtime lifecycle.

## Package Shape

A Tavern channel plugin has this shape:

```text
packages/tavern-openclaw-messenger/
  openclaw.plugin.json
  package.json
  index.js
  src/
    channel.js
    config.js
    runtime.js
    runtime-relay.js
    turn.js
    outbound.js
    message-identity.js
    turn-progress.js
```

The entry point uses `defineChannelPluginEntry` from
`openclaw/plugin-sdk/channel-core`. That lets OpenClaw handle registration mode
splitting and channel registration:

```js
export default defineChannelPluginEntry({
    id: 'tavern',
    name: 'Tavern Messenger',
    description: 'First-party Tavern chat channel for OpenClaw.',
    plugin: tavernChannelPlugin,
    setRuntime: setTavernChannelRuntime,
    registerFull(api) {
        registerTavernRuntimeHooks(api);
    },
});
```

Runtime references are stored with `createPluginRuntimeStore` from
`openclaw/plugin-sdk/runtime-store`. Long-lived code reads the runtime through
the store instead of importing host internals.

## Manifest

The manifest is the cheap source of truth:

```json
{
  "id": "tavern",
  "kind": "channel",
  "name": "Tavern Messenger",
  "description": "First-party Tavern chat channel for OpenClaw.",
  "channels": ["tavern"],
  "configSchema": {
    "type": "object",
    "additionalProperties": false,
    "properties": {}
  },
  "channelConfigs": {
    "tavern": {
      "label": "Tavern",
      "description": "Tavern chat channel settings.",
      "schema": {
        "type": "object",
        "additionalProperties": false,
        "properties": {}
      }
    }
  }
}
```

Keep this file declarative. Do not put runtime behavior, entrypoint paths, or
install behavior here. Entry files and channel catalog metadata belong in
`package.json#openclaw`.

If Tavern ever publishes this plugin as an installable OpenClaw package, add
built runtime entries:

```json
{
  "openclaw": {
    "extensions": ["./index.js"],
    "runtimeExtensions": ["./dist/index.js"]
  }
}
```

If OpenClaw needs Tavern setup or status surfaces before the full relay loads,
add a lightweight `setupEntry`. Until then, a private runtime-synced plugin can
stay simpler.

## Channel Contract

Tavern is a first-party channel with one account and channel-style chats.

The channel plugin:

* expose one account id, `default`
* normalize all targets to `chat:<tavern-chat-id>`
* reject missing or malformed chat ids at the plugin boundary
* derive the OpenClaw session route through `buildChannelOutboundSessionRoute`
* keep the Tavern chat id as the route peer id and conversation id

Do not derive OpenClaw session keys from opaque UI state. The Tavern app selects
the runtime-projected session key for the agent and chat. The plugin verifies
inbound relay messages against that expected route.

## Message Lifecycle

The channel exposes a `message` adapter from
`openclaw/plugin-sdk/channel-message`.

For Tavern today, the required durable final surface is intentionally small:

* `text`: assistant text can be delivered to Tavern
* `messageSendingHooks`: OpenClaw message-sending hooks can run before final
  delivery
* manual receive ack: the Tavern websocket relay owns its own acknowledgement
  semantics

Every visible assistant delivery returns a `MessageReceipt`. Tavern does
not need to pretend it has external platform ids. It mints a stable
`msg_<run-suffix>_final_<sequence>` assistant message id and
`del_<run-suffix>_final_<sequence>` delivery id.

Do not call deprecated direct outbound helpers from new code. New message sends
go through the channel-message lifecycle or the channel turn delivery
adapter.

## Turn Lifecycle

Tavern inbound messages enter OpenClaw through the channel turn kernel.

The preferred shape is `runtime.channel.turn.runAssembled(...)`:

1. Tavern already has the accepted message, chat id, agent id, session key, and
   sender facts.
2. The plugin builds a `FinalizedMsgContext` with
   `runtime.channel.turn.buildContext(...)`.
3. OpenClaw owns record, dispatch, reply pipeline ordering, and finalization.
4. Tavern supplies the final delivery callback and SDK-backed activity writer.

The context keeps the core fact domains separate:

* `conversation`: Tavern chat identity
* `route`: OpenClaw agent and session key
* `reply`: Tavern chat delivery route
* `message`: user-visible text and accepted message identity
* `extra`: Tavern metadata that must survive transcript projection

Use `runPrepared` only if Tavern owns a complex local dispatcher that cannot be
expressed as a delivery adapter. Current Tavern behavior fits `runAssembled`.

## Durable Identity

Accepted Tavern messages are durable before model work starts.

The accepted message contract is:

```text
message.id       Tavern durable message id
message.nonce    Tavern idempotency token, optional
message.sequence Per-chat monotonic sequence
turn.runId       Tavern/OpenClaw turn identity
sessionKey       OpenClaw route/session key
```

The plugin persists those fields into OpenClaw transcript history before
or during the first OpenClaw record stage. When OpenClaw writes a generic user
message for the same turn, the Tavern identity must be attached to that row.

The metadata shape stays stable:

```json
{
  "tavern": {
    "acceptedMessageId": "msg_...",
    "acceptedRunId": "run_...",
    "chatId": "cht_...",
    "nonce": "client nonce",
    "sequence": 12,
    "sessionKey": "agent:main:tavern:..."
  }
}
```

Runtime transcript sync then becomes identity-based:

* if a row already has `metadata.tavern.acceptedMessageId`, upsert it
* if a row has `messageId` equal to the accepted id, upsert it
* if a row lacks Tavern identity, do not infer equality from content and time

No content/timestamp duplicate detection is necessary. Tavern chat history is
canonical; OpenClaw transcript rows are execution evidence linked to Tavern
messages.

## Runtime Events

OpenClaw owns turn state. The plugin forwards OpenClaw turn state to Tavern
instead of inventing a parallel event stream.

Use `replyOptions` from the buffered dispatcher:

* `onAgentEvent` for OpenClaw tool, item, and progress events
* `onPartialReply` for assistant preamble or streaming visible text
* `onReasoningStream` for provider-exposed reasoning summaries

Then emit Tavern runtime events:

```text
turn.started
turn.replyUpdated
turn.progress
turn.completed
turn.failed
```

These events are notifications. If the websocket drops, Tavern must recover
from Tavern chat history, event cursors, runtime status, and OpenClaw execution
evidence.

Reasoning display must only use provider/OpenClaw-exposed summaries. It must
not expose hidden chain-of-thought text.

## Relay Contract

The Tavern runtime relay is a transport, not the durable log. Runtime creates or
reuses the Tavern API message before it sends an inbound frame to the plugin. If
the plugin websocket is offline, Runtime keeps the relay message pending and
returns the durable accepted receipt.

Inbound frame:

```json
{
  "kind": "inbound-message",
  "requestId": "request id",
  "agentId": "main",
  "sessionKey": "agent:main:tavern:...",
  "turnId": "run_...",
  "cursor": 123,
  "message": {
    "id": "msg_...",
    "nonce": "client nonce",
    "sequence": 12,
    "timestamp": "ISO timestamp",
    "text": "user text"
  },
  "conversation": {
    "id": "cht_...",
    "kind": "channel"
  }
}
```

Accepted frame:

```json
{
  "kind": "message-accepted",
  "requestId": "request id",
  "accepted": {
    "status": "accepted",
    "messageId": "same msg_ id",
    "nonce": "same nonce",
    "sequence": 12,
    "runId": "run_...",
    "sessionKey": "same session key",
    "cursor": 123,
    "acceptedAt": "ISO timestamp"
  }
}
```

Duplicate sends with the same Tavern durable id or nonce return the same
accepted receipt. They do not start a second OpenClaw turn.

## Tavern API Contract

The Tavern Messenger plugin speaks the Tavern Chat API, not a plugin-specific
UI contract. The Chat API is documented in
[Chat API](../api/chat.md).

The important shape is message-first:

* durable user messages are already Tavern messages before OpenClaw runs
* final assistant replies create or deliver Tavern assistant messages
* assistant preamble, tool progress, and reasoning summaries become Runtime
  Chat API activity
* completion and failure close activity, while Tavern chat history remains the
  reload source of truth

OpenClaw turn identity belongs in stable runtime metadata:

```text
runtime.source = "openclaw"
runtime.agentId
runtime.sessionKey
runtime.sessionId
runtime.runId
runtime.deliveryId
```

The plugin can keep OpenClaw words internally because it is adapting OpenClaw,
but the boundary with Tavern Runtime is Tavern API messages, receipts, activity,
and events.

OpenClaw signals adapt into Tavern API concepts:

| OpenClaw signal | Tavern API concept |
| --- | --- |
| Accepted Tavern user prompt | Durable user message receipt |
| Duplicate accepted id or nonce | Existing message receipt |
| Final assistant reply | Assistant delivery receipt |
| `onPartialReply` | Activity draft text or delta |
| `onReasoningStream` | Provider-exposed reasoning summary activity |
| Tool or item `onAgentEvent` | Activity step update |
| Turn completion | Activity completion |
| Turn failure | Activity failure plus durable failure message when projected |
| Session history sync | Runtime transcript evidence linked by stable ids |

## Coding Principles

Use narrow OpenClaw SDK subpaths.

Good imports:

```js
import { defineChannelPluginEntry } from 'openclaw/plugin-sdk/channel-core';
import { defineChannelMessageAdapter } from 'openclaw/plugin-sdk/channel-message';
import { createPluginRuntimeStore } from 'openclaw/plugin-sdk/runtime-store';
```

Avoid broad or deprecated barrels in production plugin code:

* `openclaw/plugin-sdk/compat`
* `openclaw/plugin-sdk/infra-runtime`
* `openclaw/plugin-sdk/config-runtime`
* `openclaw/plugin-sdk/channel-runtime`
* `openclaw/plugin-sdk/outbound-runtime`

Keep top-level imports side-effect-free. Websockets, background loops, file
writes, listeners, and native clients start only in full runtime paths.

Pass config through the active call path. Use `runtime.config.current()` only at
a process/runtime boundary where no config was passed in. Do not call deprecated
`loadConfig()` or `writeConfigFile(...)`.

Keep platform facts typed. Use Tavern nouns precisely:

* chat: durable Tavern conversation container
* session: OpenClaw execution history for one agent/chat route
* turn: one OpenClaw run inside a session
* message: durable user/assistant chat row
* delivery: visible outbound send result
* event: notification about state that is recoverable elsewhere

## Testing Standard

The minimum test set for this plugin proves:

* the channel entry registers under id `tavern`
* the package and manifest describe the same plugin id and channel id
* the message adapter's declared capabilities have proofs
* a Tavern accepted message id survives accepted persistence, OpenClaw turn
  record, transcript evidence mapping, app chat history, hard reload, and final sync
* duplicate sends with the same durable id or nonce return the same accepted
  receipt
* final turn sync cannot create a second user row
* tool progress appears before the final reply
* assistant preamble appears while tools are still running when OpenClaw emits
  partial assistant text
* reasoning summaries appear only when OpenClaw emits reasoning summary text
* hard reloads during a tool-heavy turn preserve one user row, ordered progress,
  and one final assistant reply

Use the app's OpenClaw mock e2e runtime for browser behavior. Use plugin unit
tests for relay parsing, identity metadata, turn options, and adapter
capabilities. Manual real-runtime chats are rare and must use obvious temporary
messages.

## Current Plugin Audit

This audit covers the current implementation in
`packages/tavern-openclaw-messenger`.

### What matches the SDK model

The entry point uses `defineChannelPluginEntry` and keeps full-only hook
registration in `registerFull`:

* `packages/tavern-openclaw-messenger/index.js`

The channel is registered with `createChatChannelPlugin`, typed routing
normalization, account resolution, route derivation, and a message adapter:

* `packages/tavern-openclaw-messenger/src/channel.js`

The plugin stores the injected runtime through `createPluginRuntimeStore`:

* `packages/tavern-openclaw-messenger/src/runtime.js`

The message adapter uses `defineChannelMessageAdapter`, returns receipts, and
declares only the current durable final capabilities:

* `packages/tavern-openclaw-messenger/src/outbound.js`

The turn path uses `runtime.channel.turn.buildContext(...)` and
`runtime.channel.turn.runAssembled(...)`, which is the right OpenClaw-owned
turn lifecycle for this channel:

* `packages/tavern-openclaw-messenger/src/turn.js`

The plugin uses `replyOptions.onAgentEvent`, `onPartialReply`, and
`onReasoningStream` to forward OpenClaw runtime state instead of fabricating
tool progress from Tavern UI state:

* `packages/tavern-openclaw-messenger/src/turn.js`
* `packages/tavern-openclaw-messenger/src/turn-progress.js`

The plugin writes final assistant replies and live activity through
`@tavern/sdk`, so Tavern state moves through the same OpenAPI-backed contract as
other clients:

* `packages/tavern-openclaw-messenger/src/tavern-api.js`
* `packages/tavern-openclaw-messenger/src/outbound.js`
* `packages/tavern-openclaw-messenger/src/runtime-relay.js`

The package has a native `openclaw.plugin.json` manifest with strict empty
config and channel config metadata:

* `packages/tavern-openclaw-messenger/openclaw.plugin.json`

### Gaps

1. Transcript identity repair reaches below the ideal channel abstraction.

`message-identity.js` and `failed-inbound-message.js` directly read, append,
and rewrite OpenClaw session JSONL files. They use host helpers such as
`appendSessionTranscriptMessage`, `emitSessionTranscriptUpdate`, and
`acquireSessionWriteLock` from `agent-harness-runtime`.

That works because Tavern is a trusted first-party plugin and because runtime
transcript evidence preserves Tavern identity before the app links it to
chat history. It is still the least SDK-shaped part of the plugin. The ideal
endpoint is an OpenClaw channel/turn API that accepts the durable inbound
message id, nonce, sequence, run id, and metadata before the transcript row is
created, making post-write JSONL repair unnecessary.

Until that exists, keep this code small, heavily tested, and isolated behind the
identity module.

2. The active-turn sidecar is a recovery shim.

`message-identity.js` stores active turn records in process memory and in a temp
directory so `before_message_write` can recover Tavern identity. This is a good
escape hatch for the current hook timing, but it is not a durable channel
contract. It disappears once OpenClaw can receive the accepted Tavern
message identity as part of the canonical record stage.

3. The hook registration requires typed OpenClaw hooks.

`registerTavernMessageIdentityHook` uses `api.on('before_message_write', ...)`
directly. Tavern controls its managed OpenClaw version, so unsupported plugin
SDK shapes fail loudly instead of carrying compatibility paths.

4. The package is private and source-loaded.

For the managed Tavern runtime this is acceptable. The runtime syncs this
package as a first-party local plugin. If Tavern wants the plugin to become an
installable external OpenClaw package, the package adds built runtime
artifacts, `runtimeExtensions`, and probably a setup entry. The current
`build` script only runs tests.

5. Startup activation is broad.

The manifest has `activation.onStartup: true`. That is understandable because
the relay must be present for Tavern-managed chats, but it means the full plugin
is part of startup. If startup latency or setup-only surfaces become important,
split a setup entry and consider deferred configured-channel full load.

6. Presentation support is intentionally absent.

The adapter does not declare `presentation`, `payload`, buttons, selects, or
pinning. That is correct for today's plain Tavern chat rendering. If Tavern
wants OpenClaw's shared rich message UI later, implement presentation rendering
as a channel-message capability instead of adding Tavern-specific fields to the
shared message action.

## Recommended Follow-Up Order

1. Open an OpenClaw-side contract request or local patch for durable inbound
   message identity at the channel turn record stage.
2. Replace transcript JSONL identity repair with that durable record-stage API.
3. Add built `runtimeExtensions` and `setupEntry` only if Tavern stops treating
   this as a private runtime-synced plugin.
