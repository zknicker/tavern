---
summary: Context management feature for Lossless Claw prompt continuity, bounded turn context, and the boundary with Cortex memory.
read_when:
  - changing Lossless Claw setup, prompt-time context readiness, or context-engine status
  - changing how active turns receive bounded context from chat, participants, activity, or Cortex recall
---

# Context Management

Context management is the prompt-time continuity layer for active turns.

Lossless Claw belongs here. Tavern configures managed OpenClaw to use Lossless
Claw as the context engine so an active OpenClaw turn can stay oriented inside
its execution context. That is not Tavern memory.

Memory means Cortex: the durable wiki, graph, capture, recall, timeline,
claims, links, embeddings, audit, and maintenance state.

## Contract

* Lossless Claw is OpenClaw context management for active turns.
* Cortex is Tavern memory.
* Context management may read Cortex recall output, chat state, activity, and
  participant context when building bounded prompt context.
* Context management does not create a durable memory database, memory record,
  or long-term source of truth.
* Cortex failures and context-engine failures are separate readiness signals.

## Managed OpenClaw Setup

Tavern's managed OpenClaw config:

* sets `plugins.slots.contextEngine` to `lossless-claw`
* sets `plugins.slots.memory` to `none`
* enables the `lossless-claw` plugin

The flat runtime capability should describe this as context-management
readiness, even if the underlying OpenClaw slot or legacy capability name still
contains `memory`.

## Relationship To Memory

Context management can place relevant Cortex memory into a prompt. It does not
own the remembered fact.

When a user corrects memory, Tavern writes Cortex material. When an agent needs
durable memory, it recalls Cortex. When an active turn needs continuity,
OpenClaw and Lossless Claw manage bounded prompt context.

## Related Docs

* [Memory](memory.md)
* [Cortex](knowledgebase.md)
* [Memory context spec](../../specs/memory-context.md)
* [Memories spec](../../specs/memories.md)
