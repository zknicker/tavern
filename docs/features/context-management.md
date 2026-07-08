---
summary: Context management feature for bounded turn context and the boundary with Tavern Memory and Wiki.
read_when:
  - changing prompt-time context readiness or context-engine status
  - changing how active turns receive bounded context from chat, participants, activity, Memory, or Wiki material
---

# Context Management

Context management is the prompt-time continuity layer for active turns.

Managed Tavern context does not use Lossless Claw. Runtime strips stale
`lossless-claw` config instead of installing or enabling that plugin.

## Contract

* Runtime injects generated agent instructions and, when Memory is enabled, the
  agent workspace `USER.md` and `MEMORY.md` core memory files.
* Runtime retrieves relevant shared Wiki pages for bounded prompt
  context: each turn's triggering message runs a semantic search over the
  Wiki recall index, and up to three pages above the relevance floor are
  injected as a clearly-labeled recalled-context block (background context, not
  user input, capped snippets). No hits, disabled Memory, or unprovisioned
  recall models inject nothing. Recall never fails a turn.
* The harness session owns prior user-agent turn history. Runtime does not
  replay a rolling Tavern transcript into every turn.
* Runtime always includes the triggering Tavern message once.
* Turn prompts are time-anchored: each prompt states the current time and every
  included chat message carries its send time, rendered as weekday-prefixed
  home-timezone wall clock (for example `Sun 2026-07-05T13:22:42-04:00`). The
  home timezone name, the staleness policy ("treat older context and prior
  data reads as stale until re-checked"), and Tavern tool guidance live in the
  agent instructions, so they are stated once per session instead of once per
  turn.
* Channel turns may include ambient channel messages since that Agent session's
  prompt context cursor. DM turns do not include ambient history because each
  DM user message already belongs to that Agent session.
* Channel ambient context is bounded to the most recent 20 eligible messages
  before the triggering message. Deleted, system, internal, and same-Agent
  assistant messages are excluded.
* Reply turns include the parent message when the cursor delta did not already
  include it.
* Agent sessions store a prompt context cursor. Runtime advances it to the
  triggering message sequence after the turn, never to the assistant response
  sequence, so messages created while the Agent is working are still eligible
  next time.
* Session resets (the agent drawer's new-session action, automatic rotation)
  snapshot the cursor at the chat's newest message, so fresh context starts at
  the reset point instead of replaying pre-reset history. Brand-new seats keep
  cursor 0 for join catch-up.
* Agent sessions rotate automatically for freshness: daily at 4am in the home
  timezone, or after 24 hours of inactivity, whichever comes first — evaluated
  when a turn is about to start. The rotated session's first turn states that
  earlier conversation is not in context; continuity comes from Memory.
* Agents can read same-chat history through read-only Tavern chat tools when
  bounded prompt context is insufficient.
* Context management does not create a separate long-term source of truth.
  Durable shared knowledge belongs to Wiki. Durable per-agent defaults belong to Memory.
* Wiki filesystem failures and context-engine failures are separate
  readiness signals.

## Runtime Setup

Runtime setup:

* sets `plugins.slots.memory` to `none`
* strips stale `lossless-claw`, `active-memory`, and `memory-core` managed
  memory plugin entries

The flat runtime capability should describe this as context-management
readiness.

## Relationship To Memory

Memory and Wiki own durable knowledge. Context management chooses what Memory, Wiki, and chat
material belongs in the active prompt.

When an active turn needs continuity, Runtime manages bounded prompt context
from chat history, participant context, core memory files, and relevant Wiki
pages. Background extraction and dreaming maintain Memory separately from the
active turn path.

## Related Docs

* [Memory](memory.md)
* [Memory API](../api/memory.md)
* [Memory ADR](../adr/0009-memory-is-one-markdown-knowledge-system.md)
