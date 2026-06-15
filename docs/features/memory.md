---
summary: Memory feature for assistant memory, Cortex wiki knowledge, and the context-management boundary.
read_when:
  - changing assistant memory, memory visibility, Cortex hub status, or Cortex-backed knowledge expectations
  - changing the boundary between Hermes context management and durable wiki knowledge
---

# Memory

Tavern has two memory surfaces:

* **Assistant memory.** Runtime configures the managed agent with the local
  Mnemosyne memory provider. It is prompt-time memory tooling, exposed to the
  agent as `memory_*` tools and surfaced operationally through Runtime
  capabilities. The provider is not a skill package and does not appear in the
  skills list.
* **Cortex knowledge.** Cortex is the browsable wiki hub. Durable knowledge that
  users inspect lives in topic wiki files. Agents use managed wiki workflows to
  research, ingest, compile, audit, and maintain those files.

## In Cortex

Users can inspect:

* the resolved wiki hub path
* active and archived topic counts
* Markdown page counts
* filesystem read/write health
* topic pages, raw sources, todo records, datasets, and outputs

## Contract

User-facing knowledge visibility is file-backed. The Memory and Cortex surfaces
read wiki Markdown. They do not expose model settings, hidden queues, generated
schemas, or internal repair controls.

Assistant memory is an execution capability. It can affect what the agent
recalls during work, but it is not the Cortex wiki and is not edited through the
wiki browser.

## Boundary

Cortex is the browsable wiki. Tasks and Runtime crons are the place for regular
wiki work.

See [Cortex](../../specs/cortex.md) and
[Context management](context-management.md).
