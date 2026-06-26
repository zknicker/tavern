---
summary: Context management feature for bounded turn context and the boundary with durable Memory.
read_when:
  - changing prompt-time context readiness or context-engine status
  - changing how active turns receive bounded context from chat, participants, activity, or Memory material
---

# Context Management

Context management is the prompt-time continuity layer for active turns.

Managed Tavern Hermes does not use Lossless Claw. It is incompatible with the
Codex app-server runtime path, so Runtime strips stale `lossless-claw` config
instead of installing or enabling that plugin.

Durable inspectable knowledge lives in Memory as plain Markdown files.

## Contract

* Memory browses durable Markdown files.
* Context management may read selected Memory material, chat state, activity,
  and participant context when building bounded prompt context.
* Context management does not create a Tavern-owned memory database, memory
  record, or long-term source of truth.
* Memory filesystem failures and context-engine failures are separate readiness
  signals.

## Managed Hermes Setup

Tavern's managed Hermes config:

* sets `plugins.slots.memory` to `none`
* strips stale `lossless-claw`, `active-memory`, and `memory-core` managed
  memory plugin entries

The flat runtime capability should describe this as context-management
readiness, even if the underlying Hermes slot or legacy capability name still
contains `memory`.

## Relationship To Memory

Context management can place selected Memory material into a prompt. It does
not own the remembered fact.

When an active turn needs continuity, Hermes manages bounded prompt context
without Lossless Claw in the managed Tavern runtime. Durable knowledge stays in
Memory.

## Related Docs

* [Memory](memory.md)
* [Memory context spec](../../specs/memory-context.md)
* [Memories spec](../../specs/memories.md)
