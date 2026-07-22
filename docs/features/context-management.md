---
summary: Context management feature — instruction composition and time-anchoring for an agent's session-scoped prompt.
read_when:
  - changing generated agent instructions or model-family operational directives
  - changing how a session's system prompt is composed or fingerprinted
---

# Context Management

Context management composes the instructions an agent's session runs with.
It does not manage per-turn continuity: a session's instructions are composed
once, delivered on the session's first turn, and reused for the rest of the
session. Per-turn content — which messages an agent sees on a given turn — is
inbox delivery, not context management; see [Agent Inbox](../../specs/inbox.md).

Durable per-agent knowledge lives in the agent's own workspace (`MEMORY.md`
and notes it maintains itself), not a Runtime-injected memory system. Memory,
Wiki, and their background extraction/dreaming/recall pipelines were retired;
see [ADR 0014](../adr/0014-cli-is-the-agents-only-output-channel.md).

## Contract

* Runtime composes generated agent instructions (managed instruction text,
  the agent's description, and CLI/tool guidance) once per session and
  fingerprints the result; `agent.session` reports `instructionsFresh: false`
  when a live session's delivered instructions no longer match a fresh
  compose (for example after an instruction-text change).
* Model-family operational directives (tool-use enforcement, execution
  discipline, Google-specific directives) are appended for models that need
  explicit steering; Claude-family models get none.
* Instructions state the current time, the home timezone, and a staleness
  policy ("treat older context and prior data reads as stale until
  re-checked") once per session rather than once per turn.
* Sessions never rotate on a schedule. A new session starts only on a model
  switch, a manual reset from agent settings, or after ~7 fully idle days
  (specs/sessions.md).
* Agents read chat history themselves through `grotto message read` /
  `grotto message search` when what inbox delivery gave them is insufficient.
