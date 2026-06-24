---
summary: Tavern Runtime adapter contract for managed Hermes turns, stream event mapping, durable activity, and model-provider test seams.
read_when:
  - changing how Tavern Runtime sends chat work to managed Hermes
  - changing Tavern chat participant to Hermes session binding or session-scoped slash commands
  - changing active-turn queueing, steering, or stop behavior
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

* image attachments are staged through Hermes Dashboard/Gateway attachment APIs
  such as `image.attach` or `image.attach_bytes` before `prompt.submit`
* non-image inline attachments are materialized under the managed workspace and
  passed as Hermes-readable `@file:` references before `prompt.submit`
* the agent-facing prompt includes Hermes-readable context refs such as
  `@file:`, `@folder:`, `@url:`, and `@image:` after attachment staging
* model inventory and default model selection come from managed Hermes model
  APIs
* newly created Hermes sessions normally rely on the Hermes default model;
  explicit per-message model choices pass model/provider in `session.create`
* model changes on an existing Hermes session use the same Gateway `config.set`
  path the Desktop app uses, then Tavern records the selected model on the
  message or response metadata
* active-turn queueing is Tavern App state until the queued draft is dispatched
  through Runtime or explicitly steered into the live turn
* text-only queued steering calls Hermes Gateway `session.steer` while the
  active turn is still live; Runtime records a durable `runtimeNotice` activity
  with the steered text and publishes `turn.steered`
* queued drafts with attachments or a model override cannot use steering; their
  "send now" action promotes the draft, interrupts the active run, and lets the
  next normal send path stage attachments or apply model selection
* stopping an active turn calls the Desktop parity Gateway method
  `session.interrupt` for the active managed Hermes session, keeps consuming
  the interrupted stream until the engine settles it, then marks the Tavern
  response `cancelled`

There is no standalone first-party Hermes plugin package in this worktree. The
adapter is Runtime code, and Runtime writes the managed Tavern Messenger
platform plugin into the managed Hermes home during startup:

| Source | Owns |
| --- | --- |
| `apps/runtime/src/hermes/supervisor.ts` | Managed `hermes dashboard --no-open` lifecycle. |
| `apps/runtime/src/hermes/local-client.ts` | Hermes dashboard REST, Gateway, sessions, models, skills, and SSE client. |
| `apps/runtime/src/hermes/shared-client.ts` | Process-wide Hermes client used by chat turns and chat-scoped slash commands. |
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
4. Runtime opens or resumes the managed Hermes session for the chat participant.
   When Runtime creates a new Hermes session, it lets Hermes apply the current
   default model unless the message carries an explicit model override. Settings
   changes use Hermes `POST /api/model/set`; display reads Hermes
   `GET /api/model/auxiliary`.
5. Runtime stages image attachments into the managed Hermes session, writes
   non-image inline attachments into the managed workspace, and resolves
   Hermes-readable context refs. Tavern message records carry attachment
   arrays.
6. Runtime applies any model change for an existing Hermes session through
   Gateway `config.set` with `key: "model"`.
7. Runtime starts `runHermesTurn(...)` with the existing `chatId`,
   `requestMessageId`, `responseId`, `runId`, `sessionKey`, resolved prompt
   text, attachment metadata, and model metadata.
8. Hermes streams turn events through Runtime.
9. Runtime upserts durable response activity while work runs.
10. Runtime creates the final assistant delivery and marks the response
   completed, or marks it failed.

Duplicate ids and nonces reconcile through the normal Chat API. Runtime must not
match messages by text or timestamp.

## Queueing And Steering

Hermes supports queue, interrupt, and steer as busy-input behaviors. Tavern does
not expose that as one global mode. The app keeps queued drafts locally, and
the user chooses the action on each queued draft.

Runtime steering is intentionally narrow:

1. The app offers steering while the active turn is still live. Assistant
   progress, narration, and tool activity do not close the steering window; a
   completed turn or durable assistant reply does.
2. The app sends `chat.steer` with `chatId`, active `runId`, text `content`,
   and optional Tavern metadata.
   The app hides the queued draft and projects the steer row immediately,
   before Runtime or Hermes responds. The draft stays in local queue storage
   until Runtime accepts the steer.
3. The server validates the chat's Runtime connection and posts to
   `/hermes/chats/{chatId}/turns/{runId}/steer`.
4. Runtime finds the active managed Hermes turn, projects Tavern mention
   metadata into Hermes-readable prompt text, and calls Gateway
   `session.steer`.
5. Hermes returns accepted status when the text was queued for the live agent.
   Runtime then publishes `turn.steered`.
6. Runtime records a `runtimeNotice` activity attached to the active response.
   The app treats that accepted activity as confirmation to delete the local
   queued draft, projects the activity as a visible, user-styled steer row, and
   does not render a separate steering system notice. The projected row is not
   a durable Tavern message.
7. If Runtime rejects the steer or the call fails, the app removes the
   optimistic steer row and restores the queued draft.

Steering never creates a Tavern user message. If the queued draft needs
attachments, image bytes, or a model override, the app must keep it as a normal
message draft and use interruption plus the normal send lifecycle instead.

## Stream Mapping

Hermes stream events become Tavern rows by stable ids.

| Hermes event | Tavern projection |
| --- | --- |
| `assistant.delta` | Active reply text; flushed as `message` response activity when tool, status, or reasoning work interrupts it. |
| `assistant.status` | `message` response activity titled `Assistant update` only for turn-progress status kinds. Runtime lifecycle notices are not chat activity. |
| `thinking.delta` | Live-only `turn.statusUpdated` rotation signal. Runtime ignores the text and does not store this as Thinking activity. |
| `reasoning.delta` | `reasoning` response activity titled `Thinking`. |
| `tool.progress` with a tool id | Running `tool_call` response activity. |
| `tool.progress` without a tool id | `message` response activity so status prose does not masquerade as a tool. |
| `tool.started` / `tool.completed` / `tool.failed` | Upserted `tool_call` activity keyed by normalized tool call id. |
| `assistant.completed` with a valid fenced `spec` block | Stores the compiled spec as `rich_response` activity and strips the raw spec from delivered assistant text. |
| `assistant.completed` with a malformed fenced `spec` block and visible prose | Strips the raw spec from delivered assistant text and delivers the prose without `rich_response` activity. |
| `assistant.completed` | Final assistant message content and optional model/provider/usage metadata. If the content contains a valid Rich Response spec, Runtime stores it as activity before completing the turn. If Hermes includes distinct final reasoning, Runtime stores it as completed `Thinking` activity. |
| `error` | Failed response with Runtime event and failure metadata. |

Visible assistant preambles and intra-turn updates are `message` response
activity. They render in the transcript like assistant narration and are not
controlled by the Appearance setting for model thinking text.

Model-internal reasoning is `reasoning` response activity titled `Thinking`.
Those rows are execution evidence and are hidden from the main chat transcript
by default. Appearance settings can show them without changing the stored
activity.

Hermes `thinking.delta` is presentation status from the engine spinner, not
provider reasoning. Runtime uses it only as a signal to rotate the themed live
presence verb next to the agent eyes; the engine's status text is not shown.

Assistant progress text is not duplicated into the final assistant message. When
Hermes includes already-flushed progress text in the completed content, Runtime
strips those progress prefixes before delivery.

Hermes can emit `assistant.completed.reasoning` with the final assistant reply
text instead of true reasoning. Runtime drops those duplicates so the final
answer does not appear again as `Thinking`.

Hermes Gateway status events carry a `kind`. Tavern records status kinds that
describe turn-visible work, such as process, goal, compression, or generic
status progress. Lifecycle notices, readiness pings, warnings, and notification
events are Runtime or Gateway UI signals, so they do not become response
activity rows in the chat transcript.

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

Hermes owns native session identity, transcripts, model state, tool state, and
context management. Tavern owns only the durable binding between a Tavern chat
participant and the Hermes session Runtime should use for that participant.
That binding is the session key contract for chat turns and chat-scoped commands.

Runtime keeps a persistent Hermes Gateway client for chat turns, matching the
Hermes Desktop pattern of a long-lived backend socket with events keyed by live
`session_id`. Runtime caches the live Hermes `session_id` for each Tavern
session key and submits follow-up turns directly to that live id. Runtime calls
`session.resume` only when it has no live id, such as after a Gateway reconnect
or Runtime restart, and then updates the live-id cache from the resume result.
Runtime closes the cached Gateway client when the Tavern Runtime server stops.

Chat turns and chat-scoped slash commands use the same shared Runtime Hermes
client and live-session cache. Commands such as `/model`, `/compress`, and other
engine-native session commands must dispatch against the same Tavern session key
that the next chat turn will use.

`/new` and `/clear` are Tavern binding operations, not independent command-runner
sessions. They close any cached live Hermes session for the Tavern session key,
drop the stored binding, and let the next turn or command create a fresh Hermes
session under the same Tavern key. `/clear` also clears the Tavern chat timeline.

`/status` is a binding read. It reports the live cached session id, stored
Hermes session id, and best-known session model for the Tavern session key
without creating, resuming, or rotating a Hermes session. The model line always
uses `Model: <model> (<provider>)`; Runtime reads live model/provider from the
Gateway when a live session exists, reads stored session model metadata when
only a bound session exists, and fills missing values with `unknown`.

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
`POST /cron/deliveries`. Runtime sets `cron.wrap_response: false` in managed
Hermes config, so chat delivery stores only the agent's output instead of
Hermes's generic cron header and management footer. Runtime then creates a
Tavern `message.delivered` receipt in the target chat.

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
