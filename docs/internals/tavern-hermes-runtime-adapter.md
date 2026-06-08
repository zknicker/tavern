---
summary: Tavern Runtime adapter contract for managed Hermes turns, stream event mapping, durable activity, and model-provider test seams.
read_when:
  - changing how Tavern Runtime sends chat work to managed Hermes
  - changing Hermes stream event mapping, assistant progress activity, thinking display, tool rows, or final delivery
  - debugging duplicated chat rows, missing progress, active turn state, or model-provider e2e behavior
---

# Tavern Hermes Runtime Adapter

Tavern treats Hermes as the native execution runtime and Tavern Runtime as the
chat server.

Runtime accepts a Tavern user message, persists it first, creates a response,
and then runs a managed Hermes turn. Hermes owns the native session, tools,
model provider calls, files, and transcript. Tavern owns durable chat messages,
responses, response activity, deliveries, events, and presentation settings.

There is no first-party Hermes plugin package in this worktree. The adapter is
Runtime code:

| Source | Owns |
| --- | --- |
| `apps/runtime/src/hermes/supervisor.ts` | Managed `hermes dashboard --no-open` lifecycle. |
| `apps/runtime/src/hermes/local-client.ts` | Hermes dashboard REST, Gateway, sessions, models, skills, and SSE client. |
| `apps/runtime/src/tavern/channel-relay.ts` | Durable user-message acceptance and response creation. |
| `apps/runtime/src/tavern/hermes-turn-runner.ts` | Hermes stream event mapping into Tavern responses, activity, delivery, and turn events. |
| `apps/runtime/src/hermes/model-config.ts` | Managed Hermes model/provider config and Codex auth sync. |

## Message Lifecycle

Accepted Tavern messages are durable before model work starts.

1. Runtime validates the target chat, agent id, message id, nonce, and
   `sessionKey`.
2. Runtime creates the Tavern user message.
3. Runtime creates a running `chat_response` for the agent.
4. Runtime starts `runHermesTurn(...)` with the existing `chatId`,
   `requestMessageId`, `responseId`, `runId`, and `sessionKey`.
5. Hermes streams turn events through Runtime.
6. Runtime upserts durable response activity while work runs.
7. Runtime creates the final assistant delivery and marks the response
   completed, or marks it failed.

Duplicate ids and nonces reconcile through the normal Chat API. Runtime must not
match messages by text or timestamp.

## Stream Mapping

Hermes stream events become Tavern rows by stable ids.

| Hermes event | Tavern projection |
| --- | --- |
| `assistant.delta` | Active reply text; flushed as `message` response activity when tool, status, or reasoning work interrupts it. |
| `assistant.status` | `message` response activity titled `Assistant update`. |
| `reasoning.delta` | `reasoning` response activity titled `Thinking`. |
| `tool.progress` with a tool id | Running `tool_call` response activity. |
| `tool.progress` without a tool id | `message` response activity so status prose does not masquerade as a tool. |
| `tool.started` / `tool.completed` / `tool.failed` | Upserted `tool_call` activity keyed by normalized tool call id. |
| `assistant.completed` | Final assistant message content and optional model/provider/usage metadata. |
| `error` | Failed response with Runtime event and failure metadata. |

Assistant progress text is not duplicated into the final assistant message. When
Hermes includes already-flushed progress text in the completed content, Runtime
strips those progress prefixes before delivery.

Reasoning is persisted as execution evidence, but Tavern App hides inline
thinking text by default. Appearance settings can show it in the main chat
transcript.

## Durable Identity

Runtime-minted ids are the product ids:

```text
msg_...   user and assistant messages
rsp_...   responses
act_...   response activity
del_...   assistant delivery receipts
```

Hermes ids stay metadata:

```text
runtime.source = "hermes"
runtime.agentId
runtime.sessionKey
runtime.runId
runtime.hermesMessageId
runtime.toolCallId
runtime.toolName
```

Activity ids include the Tavern run id plus the Hermes item or tool key so tool
updates replace the same row instead of remounting the transcript.

## Model Provider Boundary

Production Runtime configures managed Hermes with a real provider. Local e2e
tests keep Hermes live and mock only the Hermes-to-model-provider boundary with
an OpenAI-compatible provider mock.

The e2e harness sets:

```text
TAVERN_HERMES_PROVIDER=custom
TAVERN_HERMES_MODEL=tavern-e2e-tools
TAVERN_HERMES_BASE_URL=http://127.0.0.1:<mock-port>/v1
TAVERN_HERMES_API_KEY=tavern-e2e-mock-key
```

That keeps Gateway, dashboard REST, session routing, stream mapping, Runtime
storage, app cache, and browser rendering on live code.

## What Is Intentionally Missing

* A Tavern-owned Hermes transcript store as product history.
* A first-party Hermes plugin package in `packages/`.
* App-side Hermes Gateway calls.
* Mocking the whole Hermes stack in app e2e.
* Hidden chain-of-thought as message content.
