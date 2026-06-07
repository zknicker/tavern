---
summary: Tavern Messenger plugin contract for OpenClaw channel package shape, message/turn lifecycle, durable identity, relay frames, and tests.
read_when:
  - changing the Tavern OpenClaw Messenger plugin, relay, activity, or delivery path
  - changing how OpenClaw turns map into Tavern API messages, responses, activity, artifacts, or events
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
delivery state. Tavern Runtime also owns chat creation, chat-to-agent binding,
session-key binding, and chat-level Tavern metadata. Tavern App owns
presentation, optimistic UI, and websocket clients. OpenClaw owns native
execution, session transcripts, tools, provider and harness policy, and runtime
lifecycle.

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
    runtime-notices.js
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

## Channel Contract

Tavern is a first-party channel with one account and channel-style chats.

The channel plugin:

* expose one account id, `default`
* normalize all targets to `chat:<tavern-chat-id>`
* reject missing or malformed chat ids at the plugin boundary
* derive the OpenClaw session route through `buildChannelOutboundSessionRoute`
* keep the Tavern chat id as the route peer id and conversation id
* expose Tavern chats through the OpenClaw directory adapter so `#general` and
  chat titles resolve to Runtime chat ids
* expose `read` and `search` on OpenClaw's shared message tool against Tavern
  Runtime chat history

Do not derive OpenClaw session keys from opaque UI state. The Tavern app selects
the runtime session key for the agent and chat. The plugin verifies
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

Managed Tavern config sets `messages.queue.mode` to `steer` and leaves
OpenClaw's queue tunables at their native defaults. Mid-turn Tavern messages
therefore steer the active OpenClaw run when the runtime can accept steering,
and fall back to OpenClaw's normal later-turn behavior when it cannot.

The shared message tool reads Tavern chat history through Runtime:

* `message action=read` returns canonical messages from
  `/api/chats/{chat_id}/messages` with bounded latest, `before`, `after`, and
  `around` windows.
* `message action=search` returns keyword matches from
  `/api/chats/{chat_id}/messages/search`.
* `sessions_history` remains OpenClaw execution transcript evidence, not Tavern
  product chat history.

Both final-delivery paths must classify OpenClaw runtime notices before writing
assistant deliveries. OpenClaw can send verbose notices such as `🧭 New session:
<session-id>` through either the turn delivery adapter or the channel message
adapter. The plugin maps those notices to Tavern `runtimeNotice` activity and
delivers only the remaining assistant text as the final message.

## Turn Lifecycle

Tavern inbound messages enter OpenClaw through the channel turn kernel.

The preferred shape is `runtime.channel.turn.runAssembled(...)`:

1. Tavern Runtime already owns the chat, accepted message, agent id, session
   key, and sender facts.
2. The plugin builds a `FinalizedMsgContext` with
   `runtime.channel.turn.buildContext(...)`.
3. OpenClaw owns record, dispatch, reply pipeline ordering, and finalization.
4. Tavern supplies the final delivery callback and SDK-backed activity writer.

The context keeps the core fact domains separate:

* `conversation`: Tavern chat identity
* `route`: OpenClaw agent and session key
* `reply`: Tavern chat delivery route
* `message`: user-visible text and accepted message identity
* `extra`: Tavern metadata that must survive transcript mapping

Runtime attaches a bounded window of recent canonical Tavern messages to the
inbound relay frame. The plugin passes that window as OpenClaw inbound history
so agents get Discord-style recent context without reading transcript history.

Runtime also passes Tavern chat context using OpenClaw's channel fields:

* `ConversationLabel`, `GroupSubject`, and `GroupChannel` are set only for
  pinned chats or explicitly renamed chats.
* Generated temporary chat titles are not sent as conversation labels.
* `GroupSystemPrompt` is set from `metadata.tavern.groupSystemPrompt` only while
  the Tavern chat is pinned.
* `OriginatingTo` and `To` remain `chat:<tavern-chat-id>` so tools can target
  the current chat without treating raw ids as human labels.

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

Chat-level Tavern metadata stays on Tavern chat records. OpenClaw execution
metadata belongs on messages, responses, activity, delivery, and evidence rows.
The relay must not use OpenClaw routing facts to replace Tavern-owned chat
metadata such as title, status, agent bindings, session-key bindings, or
presentation state.

## Runtime Events

OpenClaw owns turn state. For OpenClaw `2026.5.27`, the Tavern
Messenger plugin maps the channel SDK `replyOptions` callbacks into Tavern API
writes.

The core mapping is:

* `kind: "preamble"` item events update one activity row per OpenClaw
  `msg_...` item id.
* `kind: "tool"` and `kind: "command"` item events create or update durable
  tool activity rows keyed by normalized tool call id.
* Unknown id-bearing item events become `custom` activity rows with the original
  OpenClaw kind preserved in metadata.
* `onCommandOutput` and `onToolResult` enrich existing tool activity rows.
* `onPartialReply` is final assistant draft streaming, not response activity.

| OpenClaw callback | Tavern API write | Contract |
| --- | --- | --- |
| `onItemEvent` with `kind: "preamble"` and `msg_...` item id | `chat.response_activity.upsert` with `message` kind | Codex commentary before tool use. It streams into the activity row for that item id and is not the final assistant reply. |
| `onItemEvent` with `kind: "preamble"` and `raw-assistant-*` item id | No durable API write | Completed raw assistant echoes duplicate the streamed `msg_...` preamble surface and are ignored. |
| `onItemEvent` with `kind: "tool"` or `kind: "command"` | `chat.response_activity.upsert` with `tool_call` kind | The live tool row starts here and is keyed by normalized tool call id. |
| `onItemEvent` with `kind: "patch"` | `chat.response_activity.upsert` with `artifact` kind | File edit activity appears in the ordered activity timeline. |
| `onItemEvent` with `kind: "reasoning"` or `kind: "analysis"` | `chat.response_activity.upsert` with `reasoning` kind | OpenClaw-exposed reasoning item status or summary appears as reasoning activity. Hidden chain-of-thought is not exposed. |
| `onItemEvent` with an unknown stable kind | `chat.response_activity.upsert` with `custom` kind | The row is recoverable and compactly renderable while Tavern preserves the source kind in metadata. |
| `onCommandOutput` | Update an existing `tool_call` activity row | Command output, exit status, duration, and command detail enrich the same row. |
| `onToolResult` | Update an existing `tool_call` activity row | Channel-visible tool output can enrich the same row, but cannot create one. |
| `onReasoningStream` | `chat.response_activity.upsert` with `reasoning` kind | Provider-exposed reasoning summaries only. |
| `onPlanUpdate` | `chat.response_activity.upsert` with `planning` kind | Live plan state. |
| `onApprovalEvent` | `chat.response_activity.upsert` with `approval` kind | Approval requests and decisions. |
| `onPatchSummary` | `chat.response_activity.upsert` with `artifact` kind | Patch/file-summary activity. |
| `onPartialReply` | No durable API write | This callback is draft text, not Tavern response activity. |

OpenClaw verbose notices such as `New session: <id>` and auto-compaction
messages are runtime telemetry, not assistant replies. The Messenger keeps
progress callbacks enabled, classifies those final payloads before creating
deliveries, and records them as `custom` response activity with
`metadata.runtime.notice`. Tavern Runtime projects those activity records into
`runtimeNotice` system rows so Tavern App can render native notice UI outside
the work disclosure.

OpenClaw steering acceptance uses the same notice surface. Gateway steering
events map to `turn.steered`, and Runtime persists a `status` runtime notice on
the active response so reconnects and reloads recover the steering marker from
chat history.

Do not add a parallel event stream or choose between alternate ids at call
sites.

Codex app-server can emit the same commentary text twice: first as a streamed
`onItemEvent` preamble with a normal `msg_...` item id, then as a completed
raw assistant response item that OpenClaw maps back to `kind: "preamble"` with
an id like `raw-assistant-2`. Tavern uses the `msg_...` id as the activity row
identity because it is the live streaming identity. `raw-assistant-*` preamble
items are ignored because they are completed transcript echoes of the streamed
commentary item. `raw-assistant-*` message items also remain ignored because
final assistant text belongs to the delivery path.

The plugin writes Tavern API records. Runtime emits durable chat events from
those writes:

```text
response.created
response.updated
response.completed
response.failed
activity.created
activity.updated
activity.completed
activity.failed
message.delivered
```

These events are notifications. If the websocket drops, Tavern recovers from
chat history, event cursors, response reads, activity reads, and OpenClaw
execution evidence.

Activity ids written to Tavern are scoped to the OpenClaw turn. OpenClaw item
ids can repeat across turns, so raw item ids must stay in metadata and must not
become global Tavern activity ids.

Tool activity identity is pinned to the normalized OpenClaw tool call id:

* `toolCallId` and `callId` are canonical tool-call ids.
* `itemId` is canonical only after parsing OpenClaw's current tool wrapper
  shape: `tool:<toolCallId>` or `tool:<toolCallId>|<providerItemId>`.
* tool activity ids use `act_<runId>_<normalizedToolCallId>`.
* raw `itemId`, `id`, `toolCallId`, `callId`, and provider item ids stay in
  activity metadata for audit.
* a tool-like event without a normalized tool call id is not durable tool
  activity.

Reasoning display must only use provider/OpenClaw-exposed summaries. It must
not expose hidden chain-of-thought text.

## Relay Contract

The Tavern runtime relay is a transport, not the durable log. Runtime must
already own the Tavern chat and create the durable Tavern API message before it
sends an inbound frame to the plugin. The relay does not create chats, ensure
chats, repair chats, or write chat-level Tavern metadata. If the plugin
websocket is offline, Runtime keeps the relay message pending and returns the
durable accepted receipt.

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
* activity ids are stable inside Tavern and include turn identity
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

For OpenClaw `2026.5.27`, turn phases adapt into Tavern API writes:

| OpenClaw callback or phase | Tavern API write | User-facing behavior |
| --- | --- | --- |
| Accepted Tavern user prompt | `chat.messages.create` user message receipt | The user message appears immediately and remains reloadable. |
| Duplicate accepted id or nonce | Existing user message receipt | Retries do not create duplicate chat rows. |
| Turn start | `chat.responses.upsert` with `running` status | The chat shows an active response and a working timer. |
| `onPlanUpdate` | `chat.response_activity.upsert` with `planning` kind | Planning appears as a live response activity row. |
| `onReasoningStream` | `chat.response_activity.upsert` with `reasoning` kind | Provider-exposed reasoning summaries appear as live activity. |
| `onItemEvent` preamble item with `msg_...` id | `chat.response_activity.upsert` with `message` kind | Codex commentary preambles appear before tools finish without becoming final answers. |
| `onItemEvent` preamble item with `raw-assistant-*` id | No durable API write | Completed raw assistant echoes do not duplicate streamed commentary rows. |
| `onItemEvent` command or tool item | `chat.response_activity.upsert` with `tool_call` kind, keyed by normalized tool call id | A tool row appears as soon as the tool starts. |
| Unknown id-bearing `onItemEvent` kind | `chat.response_activity.upsert` with `custom` kind | Tavern keeps the source activity visible without inventing first-class semantics. |
| `onCommandOutput` | Update the existing activity row by normalized tool call id | Output, exit status, duration, and command detail enrich the same tool row. |
| `onApprovalEvent` | `chat.response_activity.upsert` with `approval` kind | Approval requests and decisions appear in the response activity timeline. |
| `onPatchSummary` | `chat.response_activity.upsert` with `artifact` kind | File edits or patch summaries appear as activity and may link artifacts. |
| `onToolResult` | Enrich an existing tool activity row only when it has the same normalized tool call id | Channel-visible tool output may add details to the same row. |
| Turn completion | `chat.deliveries.create` assistant message plus `chat.responses.upsert` with `completed` status | The final assistant message appears and the activity group becomes completed. |
| Turn failure | `chat.responses.upsert` with `failed` status and failed activity rows where available | The chat shows the failed response without inventing a final message. |
| Session history sync | Runtime execution evidence linked by stable ids | Reload and audit views can inspect the native OpenClaw transcript. |
| Child session evidence | Tavern worker row linked by session key | Subagent-like work appears as related worker activity when OpenClaw exposes a child session relationship. |

`onItemEvent` is the live progress source for tool activity. OpenClaw command
items can start with a generic title such as `Command`; Tavern derives the row
label from `name`, `meta`, `summary`, or later output details and does not
persist `Command` as durable tool identity.

`onCommandOutput` enriches existing command rows with structured output and
status. `onToolResult` is a channel-visible reply payload, not canonical tool
identity. It may enrich an existing row when OpenClaw includes the same
normalized tool call id, but it must not create a new activity row. If no
matching row exists, the mapper fails the contract instead of creating anonymous
tool activity.

The plugin does not register `onToolStart` for durable activity. That callback
does not include stable activity identity, and registering it suppresses richer
ID-bearing `onItemEvent` callbacks for some tool-like items.

`onPartialReply` is OpenClaw's draft text preview surface. The Messenger plugin
does not write it to durable response activity. Final assistant message
streaming needs a dedicated draft-message path, not preamble activity rows.

Gateway operator events, such as `session.tool`, are useful for contract tests
and debugging. The Messenger write path uses channel SDK callbacks because the
plugin is the channel integration that owns Tavern API writes.

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
* id-bearing `onItemEvent` tool progress appears before the final reply
* generic `Command` item events do not display `Command` or overwrite richer tool rows
* command output and transcript sync update one activity row keyed by normalized
  OpenClaw tool call id
* Codex commentary preamble appears while tools are still running when OpenClaw
  emits a preamble item event
* streamed `msg_...` preamble events update one durable activity row per
  OpenClaw item id
* raw `raw-assistant-*` preamble echoes do not create duplicate activity rows
* `raw-assistant-*` message mirror events do not create assistant activity rows
* unknown id-bearing `onItemEvent` kinds become compact `custom` activity rows
* reasoning summaries appear only when OpenClaw emits reasoning summary text
* hard reloads during a tool-heavy turn preserve one user row, ordered progress,
  and one final assistant reply

Use the app's OpenClaw mock e2e runtime for browser behavior. Use plugin unit
tests for relay parsing, identity metadata, turn options, and adapter
capabilities. Manual real-runtime chats are rare and must use obvious temporary
messages.

## Implementation Anchors

The current implementation lives in `packages/tavern-openclaw-messenger`:

* `index.js` registers the Tavern channel plugin.
* `src/channel.js` owns channel routing, account resolution, and message adapter
  wiring.
* `src/runtime-relay.js` owns the Tavern Runtime websocket relay.
* `src/turn.js` runs OpenClaw channel turns and wires reply callbacks.
* `src/turn-progress.js` maps OpenClaw callback payloads into Tavern activity
  rows.
* `src/tavern-api.js` writes messages, responses, activity, and deliveries
  through `@tavern/sdk`.
* `src/message-identity.js` attaches Tavern message identity to OpenClaw
  transcript evidence.
* `openclaw.plugin.json` declares the channel plugin manifest.
