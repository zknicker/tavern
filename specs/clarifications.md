# Clarifications

Clarifications are mid-turn questions from the agent to the user.

## Product Contract

- A clarification is not presented as a raw tool call. It is a response
  activity in the active chat turn.
- The activity renders inline in the work log with the question, any provided
  choices, an Other answer when choices exist, and a Skip action.
- Choices are suggestions, not a closed protocol. The user can send free text
  when the prompt needs it.
- Skip is an explicit answer. Tavern sends
  `The user cancelled. Use your best judgement to proceed.` to the agent
  engine.
- Timeout is an explicit answer. Tavern Runtime owns a timeout shorter than
  the engine's clarification wait and sends
  `The user did not provide an answer before Tavern timed out. Use your best judgement to proceed.`
  before the engine fallback can decide the turn.
- A completed clarification remains visible as answered, skipped, or timed out.

## Runtime Contract

- The engine emits `clarify.request` with a stable request id, a question, and
  optional choices.
- Tavern Runtime records the prompt as response activity with
  `metadata.clarification` and `metadata.runtime.toolName = "clarify"`.
- The durable activity uses the existing custom activity kind and projects to a
  live `turn.progress` tool step named `clarify` with a typed `clarification`
  payload.
- The app responds through `chat.clarification.respond`, which forwards to the
  Runtime session clarification endpoint and then to the engine
  `clarify.respond` RPC.
- Runtime clears the local timeout and completes the activity after a successful
  answer, skip, or timeout response.

## Presentation

- Clarification rows use the same tool-row drawer, grouping, and live/durable
  reconciliation behavior as other work activity.
- The collapsed active work label reads `Needs an answer`, not `Using clarify`
  or `Using <question>`.
- Only the first pending clarification row in a work group exposes active
  response controls.
