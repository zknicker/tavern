# Tavern Messenger Runtime Channel

Tavern Messenger is Tavern's first-party chat channel for Hermes. The channel is not ACP, a
generic IDE bridge, or a fallback over Hermes's operator session APIs.

## Position

```txt
Tavern App
  -> Tavern API
  -> Tavern Runtime chat server
  -> Tavern Messenger channel/plugin
  -> Hermes execution
```

Tavern App speaks Tavern API records such as `chat`, `message`, `event`, `session`, `turn`, and
`tool`. Tavern Runtime owns the durable chat server and keeps Hermes Gateway payloads behind the
Hermes adapter.

## Architecture

```mermaid
flowchart LR
    subgraph Tavern["Tavern"]
        App["Tavern App<br/>first-party Mac client"]
        API["Tavern API<br/>chat, message, event APIs"]
        Driver["Tavern Runtime<br/>chat server and managed Hermes relay"]
        SDK["TypeScript SDK<br/>Tavern API client"]
        Store["Runtime SQLite<br/>chats, messages, events, delivery"]
    end

    subgraph Adapter["Runtime Adapter Package"]
        OCAdapter["@tavern/hermes-gateway-adapter"]
        Mapper["Gateway mappers<br/>parse, validate, rename, emit"]
    end

    subgraph Hermes["Hermes"]
        Gateway["Hermes Gateway<br/>RPC and event stream"]
        Messenger["Tavern Messenger<br/>first-party channel/plugin"]
        Runtime["Hermes execution<br/>sessions, turns, tools, history"]
    end

    App -->|"send message + clientMessageId"| API
    API -->|"postMessage(chat, one bound agent)"| Driver
    Driver -->|"inbound-message over /chat"| Messenger
    Messenger --> Runtime

    Runtime -->|"accepted run id"| Messenger
    Messenger -->|"message-accepted"| Driver
    Driver -->|"accepted receipt"| API
    API -->|"accepted receipt"| App

    Runtime -. "turn/tool/reasoning callbacks" .-> Messenger
    Messenger -. "activity + delivery writes" .-> SDK
    SDK -. "OpenAPI requests" .-> API
    API -. "events + client notifications" .-> App

    Runtime ==>|"durable history snapshots"| Gateway
    Gateway ==>|"chat.history / sessions.*"| OCAdapter
    OCAdapter ==>|"session, turn, transcript evidence"| Store
    Store ==>|"chat history and event reads"| API
```

The fast lane is the accepted receipt plus SDK-backed activity writes. The durable lane is
Runtime-owned chat state linked to Hermes history as execution evidence. The UI renders progress
from Runtime activity while durable message history stays canonical.

## Model

- One Tavern chat has exactly one bound Hermes agent.
- One Tavern chat is one long-lived, single-threaded conversation.
- Sends use text as the agent-facing prompt and may include Tavern-owned message metadata for
  presentation.
- Tavern App does not choose an "active agent" inside a chat.
- Tavern Runtime must install the Tavern Messenger plugin into managed Hermes before launch.
  Tavern chat send is gated by the managed Hermes `gateway` capability and does not fall back to
  `sessions.send`, `chat.send`, ACP, platform-specific targets, or Tavern-specific Gateway RPCs.

Tavern Runtime accepts Tavern chat messages through Tavern API and relays private channel frames to
the Tavern Messenger plugin.

Hermes tool names exposed by Tavern-owned plugins must use provider-safe
identifiers: letters, numbers, underscores, and hyphens only. Do not use dotted
names such as `cortex.search`; Codex and provider tool APIs may reject them
before a turn starts.

## Channel Responsibilities

Tavern Messenger channel/plugin preserves first-party Tavern facts instead of forcing Tavern to
reconstruct them from transport-specific labels.

- Stable Tavern chat id.
- Hermes session key for the chat's single bound agent. Hermes Tavern session keys must be
  chat-specific, using `agent:<agent-id>:tavern:channel:<tavern-chat-id>`, with Hermes
  `chatType: "channel"` and `peer.kind: "channel"`. They must not collapse to the agent's `main`
  session through generic direct-message scoping.
- Hermes session id when available. This is the current transcript identity for the session key,
  not the chat/session routing key. Tavern stores it as the session id while still using
  `sessionKey` for lookup and sends.
- Client message id or idempotency key supplied by Tavern.
- Optional message metadata supplied by Tavern, including `metadata.tavern.mentions`.
- Hermes run, turn, message, and tool call ids when Hermes creates them.
- Participant ids, observed labels, and source identity facts.
- Delivery metadata such as accepted, delivered, failed, active reply, approval, and tool state.
- Timestamps supplied by the source event or runtime record.

If a required id, timestamp, actor, or session key is absent, the plugin or adapter reports a
degraded capability or fails the mapping. It does not invent product identity.

The channel/plugin must not publish a Tavern chat catalog. Tavern Runtime owns Tavern chat
existence, bindings, durable messages, and labels. Tavern App owns presentation. Hermes Tavern
sessions are execution facts that attach to an existing Tavern chat; they are not a source for
creating or renaming Tavern chats.

## Adapter Responsibilities

The Hermes adapter maps Gateway payloads into Tavern API records and runtime evidence records.

- Do not require Tavern Messenger plugin methods for Tavern chat send or chat registry operations.
- Validate required Tavern Messenger fields.
- Normalize Hermes Gateway event names into runtime evidence invalidation records.
- Do not map Hermes Tavern sessions into `AgentRuntimeChat` rows. Tavern chat rows come only from
  Tavern-owned create/update flows.
- Map external runtime-owned channel chats into runtime chat evidence rows with typed platform
  metadata.
- Map durable runtime history into session message records.
- Map live reply and tool activity onto Tavern API responses and activity, not adapter-local chat
  events.
- Keep Gateway method names, plugin versions, and channel quirks out of app/domain code.

The adapter is mostly `parse -> validate -> rename -> emit`. If it must derive product meaning from
labels or opaque ids, the Tavern Messenger channel contract is missing a field.

## Runtime Relay

Tavern Runtime exposes a private local WebSocket at `/chat`. Tavern Messenger plugin connects to
that relay from inside managed Hermes. Tavern API writes chat sends into Runtime, and Runtime
forwards them as `inbound-message` frames.

The plugin maps responses and response activity through `@tavern/sdk` and the
Tavern Chat API. Activity can include tool starts, tool results, command output,
plan updates, assistant draft text, and provider-exposed reasoning summaries.
Tavern renders it as visible response work; it is not an Hermes transcript row
and does not expose private reasoning content.

Runtime WebSocket delivery is a notification path, not the source of truth. Tavern Runtime stores
durable messages, responses, response activity, artifacts, and cursor-backed
chat events before broadcasting. The private plugin relay keeps only a small
outbox keyed by the durable Tavern message id. A reconnecting client can
backfill accepted messages, running responses, activity, and artifacts from
Runtime over HTTP or websocket replay using a cursor. If a websocket
notification is missed, hard reload reconstructs the accepted user message and
response work from Runtime state.

## Cron Delivery

Tavern Messenger also registers as a Hermes platform named `tavern`. That makes
Hermes cron jobs able to use `deliver=tavern:<chat-id>` without modifying
Hermes source.

For cron output, the plugin is a sender rather than a chat catalog or timeline
owner:

1. Tavern Runtime creates or edits the cron job through Hermes's Cron HTTP API.
2. The Tavern destination chat is encoded as `deliver: "tavern:<chatId>"`.
3. Hermes executes the cron job and calls the Tavern platform adapter or its
   standalone sender.
4. The plugin posts the assistant output to Runtime `POST /cron/deliveries`.
5. Runtime validates the target Tavern chat and writes the assistant message
   through the normal Tavern delivery receipt path.

Cron delivery must not create Tavern chats from Hermes data. If the target
`cht_...` record is missing, delivery fails instead of inventing a chat.

## Message Metadata

Tavern Messenger preserves Tavern-owned message metadata on the durable user message. Hermes may
store the metadata, but it does not interpret `metadata.tavern`.

Mentions use this shape:

```json
{
  "metadata": {
    "tavern": {
      "mentions": [
        {
          "kind": "skill",
          "id": "/Users/zknicker/.agents/skills/ui/SKILL.md",
          "label": "ui",
          "text": "[$ui](/Users/zknicker/.agents/skills/ui/SKILL.md)",
          "projection": "skill-context",
          "start": 4,
          "end": 53
        }
      ]
    }
  }
}
```

The durable message text remains the normal message content. Tavern Messenger maps skill mentions
into the execution-only `bodyForAgent` as Codex-style skill context. Capability and path
mentions stay as visible markdown in the message text. Mention metadata is not a tool call,
command, or policy grant.

## Chat Send Flow

Tavern does not wait for durable history sync before showing progress.

1. Tavern App creates a client message id and renders an app-local optimistic user row.
2. Tavern Runtime validates the selected chat has exactly one bound agent and a synced session key.
3. Tavern Runtime creates or reuses the durable Tavern API message and cursor-backed
   `message.created` event.
4. Tavern Runtime writes a private plugin outbox entry keyed by the durable message id, then relays
   an `inbound-message` with the chat id, bound Hermes agent id, session key, message text,
   message id, nonce, per-chat sequence, and optional message metadata.
5. Tavern Messenger accepts the send and returns a run id through Runtime.
6. Tavern Runtime exposes the accepted message through chat history so reload does not wait for
   final transcript sync.
7. The plugin maps response, message delta, tool, reasoning-summary, artifact,
   and completion state onto Tavern API responses and activity. Leaving and
   returning to a chat reads durable responses and activity from Runtime.
8. Tavern Messenger persists the accepted Tavern message id, nonce, run id, session key, and
   sequence into Hermes transcript history.
9. Hermes transcript sync links execution evidence by stable Tavern ids. The accepted user row and
   final assistant delivery are already durable Tavern records, so final sync is a pure evidence
   upsert rather than content/timestamp deduplication.

Optimistic rows are app-local presentation state. Accepted messages, responses,
and response activity are recoverable Runtime state, but response activity is
not a second Hermes transcript.

## ACP

ACP is not part of Tavern Messenger. ACP may remain useful for IDE or client harness integration,
but Tavern Messenger is the primary channel for Tavern chat because it preserves richer Tavern
concepts such as chat identity, participants, approvals, active reply state, tool execution, and
delivery metadata.
