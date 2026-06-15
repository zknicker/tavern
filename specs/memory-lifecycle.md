# Memory Lifecycle

Tavern memory lifecycle follows the Cortex wiki lifecycle.

There is no separate durable memory pool, promotion queue, capture database, or
repair ranking system in Tavern Runtime. Durable knowledge lives as Markdown in
the Cortex wiki hub.

## Context Management Boundary

Hermes owns live execution context for turns.

Prompt-time context management helps the agent stay oriented during active
work, but it is not Tavern memory. Managed Tavern Hermes keeps Hermes-native
memory disabled and installs the managed `cortex-wiki` skill for durable knowledge work.

## Wiki Lifecycle

Tavern wiki workflows own durable knowledge files under the hub:

```txt
topics/<topic>/
  raw/
  wiki/
  inventory/
  datasets/
  output/
  inbox/
```

Agents write and maintain those files through the managed `cortex-wiki` skill. Tavern Runtime
does not run a hidden capture, recall, embedding, or repair pipeline.

## Correction And Forgetting

Corrections are wiki edits. Forgetting is explicit wiki archive, rewrite, or
delete work performed by agents through Tasks or operator-directed runs.

The Cortex tab reflects the current hub state; it does not keep a second copy.

## Maintenance

Maintenance is scheduled work, not a built-in Runtime subsystem.

Tasks and runtime crons can run wiki research, ingest, query, compile, audit,
and output workflows. Runtime exposes hub readiness and browsing APIs so those
jobs can be inspected from Tavern.
