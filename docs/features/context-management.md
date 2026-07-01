---
summary: Context management feature for bounded turn context and the boundary with Vault memory.
read_when:
  - changing prompt-time context readiness or context-engine status
  - changing how active turns receive bounded context from chat, participants, activity, or wiki material
---

# Context Management

Context management is the prompt-time continuity layer for active turns.

Managed Tavern context does not use Lossless Claw. Runtime strips stale
`lossless-claw` config instead of installing or enabling that plugin.

Assistant memory is the engine's prompt-time `MEMORY.md` and `USER.md`
snapshot. Durable inspectable knowledge lives in the Vault wiki as plain
Markdown files.

## Contract

* Vault browses Markdown wiki files.
* Context management may read wiki material, chat state, activity, and
  participant context when building bounded prompt context.
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
  the bounded prompt context is insufficient.
* Context management does not create a Tavern-owned memory database, memory
  record, or long-term source of truth.
* Wiki filesystem failures and context-engine failures are separate readiness
  signals.

## Runtime Setup

Runtime setup:

* sets `plugins.slots.memory` to `none`
* strips stale `lossless-claw`, `active-memory`, and `memory-core` managed
  memory plugin entries

The flat runtime capability should describe this as context-management
readiness.

## Relationship To Memory

Context management can place relevant wiki material into a prompt. It does not
own the remembered fact.

When an agent needs compact prompt-time memory, it uses built-in assistant
memory. When it needs durable, inspectable knowledge, it reads or queries the
Vault wiki. When an active turn needs continuity, Runtime manages bounded
prompt context without Lossless Claw in the managed Tavern runtime.

## Related Docs

* [Memory](memory.md)
* [Vault](vault.md)
* [Memory context spec](../../specs/memory-context.md)
* [Memories spec](../../specs/memories.md)
