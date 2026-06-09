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

Tavern follows the Hermes Desktop app as the north-star for managed Hermes chat
behavior. The app composer remains Tavern-owned and compositional, but Runtime
maps its controls onto managed Hermes surfaces:

* file and image attachments are staged through Hermes Dashboard/Gateway
  attachment APIs such as `file.attach`, `image.attach`, or `image.attach_bytes`
  before `prompt.submit`
* the agent-facing prompt includes Hermes-readable context refs such as
  `@file:`, `@folder:`, `@url:`, and `@image:` after attachment staging
* model inventory and default model selection come from managed Hermes config
  and model APIs
* session-scoped model changes use the same Hermes session model command path
  the Desktop app uses, then Tavern records the selected model on the message or
  response metadata
* active-turn queueing is Tavern App state until the queued draft is dispatched
  through Runtime
* stopping an active turn calls the Desktop parity Gateway method
  `session.interrupt` for the active managed Hermes session

There is no standalone first-party Hermes plugin package in this worktree. The
adapter is Runtime code, and Runtime writes the managed Tavern Messenger
platform plugin into the managed Hermes home during startup:

| Source | Owns |
| --- | --- |
| `apps/runtime/src/hermes/supervisor.ts` | Managed `hermes dashboard --no-open` lifecycle. |
| `apps/runtime/src/hermes/local-client.ts` | Hermes dashboard REST, Gateway, sessions, models, skills, and SSE client. |
| `apps/runtime/src/hermes/session-map.ts` | Tavern session key to Hermes stored-session key mapping in Runtime SQLite. |
| `apps/runtime/src/hermes/tavern-messenger-plugin.ts` | Managed Hermes platform plugin files for Tavern cron delivery. |
| `apps/runtime/src/tavern/channel-relay.ts` | Durable user-message acceptance and response creation. |
| `apps/runtime/src/tavern/cron-delivery.ts` | Private Runtime endpoint that writes Hermes cron output as Tavern deliveries. |
| `apps/runtime/src/tavern/hermes-turn-runner.ts` | Hermes stream event mapping into Tavern responses, activity, delivery, and turn events. |
| `apps/runtime/src/hermes/model-config.ts` | Managed Hermes model/provider config and Codex auth sync. |

## Message Lifecycle

Accepted Tavern messages are durable before model work starts.

1. Runtime validates the target chat, agent id, message id, nonce, and
   `sessionKey`.
2. Runtime creates the Tavern user message.
3. Runtime creates a running `chat_response` for the agent.
4. Runtime stages any message attachments into the managed Hermes session and
   resolves Hermes-readable context refs. Tavern message records carry
   attachment arrays.
5. Runtime applies any session-scoped model choice through `slash.exec` with the
   Hermes `/model` command.
6. Runtime starts `runHermesTurn(...)` with the existing `chatId`,
   `requestMessageId`, `responseId`, `runId`, `sessionKey`, resolved prompt
   text, attachment metadata, and model metadata.
7. Hermes streams turn events through Runtime.
8. Runtime upserts durable response activity while work runs.
9. Runtime creates the final assistant delivery and marks the response
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

Tavern session routing stores `tavernSessionKey -> hermesSessionKey` in Runtime
SQLite. Runtime does not write `tavern-session-map.json` under the Hermes home;
the managed Hermes home is execution state, not Tavern routing state.

## Cron Delivery

Tavern cron configuration uses Hermes's Cron HTTP API. Runtime maps Tavern cron
requests to `/api/cron/jobs`, `/api/cron/jobs/{id}`, pause/resume, trigger, and
run-history endpoints. Hermes remains canonical for schedule execution and run
history.

Cron delivery to a Tavern chat uses Hermes platform delivery, not Hermes source
patches. Runtime installs the `tavern-messenger-platform` plugin into managed
Hermes and enables it in managed `config.yaml`. Tavern cron jobs with a chat
destination send `deliver: "tavern:<chatId>"`; Hermes calls the plugin's live
adapter or standalone sender, and the plugin posts to Runtime
`POST /cron/deliveries`. Runtime then creates a Tavern `message.delivered`
receipt in the target chat.

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
* A standalone first-party Hermes plugin package in `packages/`.
* App-side Hermes Gateway calls.
* Mocking the whole Hermes stack in app e2e.
* Hidden chain-of-thought as message content.
