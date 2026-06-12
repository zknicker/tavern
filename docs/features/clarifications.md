---
summary: Mid-turn clarification prompts, choices, free-text answers, skip, timeout, and chat presentation.
read_when:
  - changing mid-turn user questions or clarification prompts
  - changing clarify.request, clarify.respond, skip, timeout, or prompt UI
  - changing chat activity rows for agent questions
---

# Clarifications

Clarifications let an agent ask the user a question during an active turn and
then continue after the answer.

The prompt appears in the chat work log, not as a generic tool invocation. It
shows the question, provided choices, an Other answer path, Skip, and timeout
state. Answering, skipping, and timeout all send explicit text back to the
agent engine through `chat.clarification.respond`.

Tavern Runtime owns the timeout. The default is shorter than the engine wait so
the Runtime sends the timeout response before the engine's fallback path. The
settled row remains in history as answered, skipped, or timed out.

See [Clarifications](../../specs/clarifications.md) for the runtime and
presentation contract.
