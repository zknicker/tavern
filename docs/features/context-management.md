---
summary: Context management feature for bounded turn context and the boundary with Tavern Memory.
read_when:
  - changing prompt-time context readiness or context-engine status
  - changing how active turns receive bounded context from chat, participants, activity, or Memory material
---

# Context Management

Context management is the prompt-time continuity layer for active turns.

Managed Tavern context does not use Lossless Claw. Runtime strips stale
`lossless-claw` config instead of installing or enabling that plugin.

## Contract

* Runtime injects generated agent instructions and, when Memory is enabled, the
  agent workspace `USER.md` and `MEMORY.md` briefing files.
* Runtime may retrieve relevant shared Semantic Memory material for bounded
  prompt context.
* The harness session owns prior user-agent turn history. Runtime does not
  replay a rolling Tavern transcript into every turn.
* Runtime always includes the triggering Tavern message once.
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
* Agents can read same-chat history through read-only Tavern chat tools when
  bounded prompt context is insufficient.
* Context management does not create a separate long-term source of truth.
  Durable knowledge belongs to Memory.
* Semantic Memory filesystem failures and context-engine failures are separate
  readiness signals.

## Runtime Setup

Runtime setup:

* sets `plugins.slots.memory` to `none`
* strips stale `lossless-claw`, `active-memory`, and `memory-core` managed
  memory plugin entries

The flat runtime capability should describe this as context-management
readiness.

## Relationship To Memory

Memory owns durable knowledge. Context management chooses what Memory and chat
material belongs in the active prompt.

When an active turn needs continuity, Runtime manages bounded prompt context
from chat history, participant context, briefing files, and relevant Semantic
Memory. Background extraction and dreaming maintain Memory separately from the
active turn path.

## Related Docs

* [Memory](memory.md)
* [Memory API](../api/memory.md)
* [Memory ADR](../adr/0009-memory-is-one-markdown-knowledge-system.md)
