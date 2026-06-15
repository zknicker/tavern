---
summary: Memory feature for Cortex-backed durable knowledge and the context-management boundary.
read_when:
  - changing memory visibility, Cortex hub status, or Cortex-backed knowledge expectations
  - changing the boundary between Hermes context management and durable wiki knowledge
---

# Memory

Memory is the Cortex wiki hub.

Tavern does not maintain a separate durable memory database. Durable knowledge
lives in topic wiki files. Agents use managed wiki workflows to research, ingest,
compile, audit, and maintain those files.

## In Cortex

Users can inspect:

* the resolved wiki hub path
* active and archived topic counts
* Markdown page counts
* filesystem read/write health
* topic pages, raw sources, todo records, datasets, and outputs

## Contract

Memory visibility is file-backed. The Memory and Cortex surfaces read wiki
Markdown. They do not expose model settings, hidden queues, generated schemas,
or internal repair controls.

Prompt-time context management remains separate. Hermes may use relevant wiki
material when an agent reads it, but Hermes context management does not own the
remembered fact.

## Boundary

Cortex is the browsable wiki. Tasks and Runtime crons are the place for regular
wiki work.

See [Cortex](../../specs/cortex.md) and
[Context management](context-management.md).
