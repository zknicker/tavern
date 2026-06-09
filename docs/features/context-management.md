---
summary: Context management feature for bounded turn context and the boundary with Cortex memory.
read_when:
  - changing prompt-time context readiness or context-engine status
  - changing how active turns receive bounded context from chat, participants, activity, or wiki material
---

# Context Management

Context management is the prompt-time continuity layer for active turns.

Managed Tavern Hermes does not use Lossless Claw. It is incompatible with the
Codex app-server runtime path, so Runtime strips stale `lossless-claw` config
instead of installing or enabling that plugin.

Memory means the llm-wiki hub that Cortex can browse. The durable facts live in
plain Markdown topic wikis.

## Contract

* Cortex browses llm-wiki Markdown.
* Context management may read wiki material, chat state, activity, and
  participant context when building bounded prompt context.
* Context management does not create a durable memory database, memory record,
  or long-term source of truth.
* Wiki filesystem failures and context-engine failures are separate readiness
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

Context management can place relevant wiki material into a prompt. It does not
own the remembered fact.

When an agent needs durable memory, it reads or queries the llm-wiki hub. When
an active turn needs continuity, Hermes manages bounded prompt context without
Lossless Claw in the managed Tavern runtime.

## Related Docs

* [Memory](memory.md)
* [Cortex](knowledgebase.md)
* [Memory context spec](../../specs/memory-context.md)
* [Memories spec](../../specs/memories.md)
