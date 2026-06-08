---
summary: Context management feature for bounded turn context and the boundary with Cortex memory.
read_when:
  - changing prompt-time context readiness or context-engine status
  - changing how active turns receive bounded context from chat, participants, activity, or Cortex recall
---

# Context Management

Context management is the prompt-time continuity layer for active turns.

Managed Tavern Hermes does not use Lossless Claw. It is incompatible with the
Codex harness Tavern launches through managed Hermes, so Runtime strips stale
`lossless-claw` config instead of installing or enabling that plugin.

Memory means Cortex: the durable wiki, graph, capture, recall, timeline,
claims, links, embeddings, audit, and maintenance state.

## Contract

* Cortex is Tavern memory.
* Context management may read Cortex recall output, chat state, activity, and
  participant context when building bounded prompt context.
* Context management does not create a durable memory database, memory record,
  or long-term source of truth.
* Cortex failures and context-engine failures are separate readiness signals.

## Managed Hermes Setup

Tavern's managed Hermes config:

* sets `plugins.slots.memory` to `none`
* strips stale `lossless-claw`, `active-memory`, and `memory-core` managed
  memory plugin entries

The flat runtime capability should describe this as context-management
readiness, even if the underlying Hermes slot or legacy capability name still
contains `memory`.

## Relationship To Memory

Context management can place relevant Cortex memory into a prompt. It does not
own the remembered fact.

When a user corrects memory, Tavern writes Cortex material. When an agent needs
durable memory, it recalls Cortex. When an active turn needs continuity,
Hermes manages bounded prompt context without Lossless Claw in the managed
Tavern runtime.

## Related Docs

* [Memory](memory.md)
* [Cortex](knowledgebase.md)
* [Memory context spec](../../specs/memory-context.md)
* [Memories spec](../../specs/memories.md)
