# Memory Lifecycle

Tavern Memory is one durable Markdown root with L1 briefings, semantic pages,
episodic observations, and routine memory.

There is no Tavern-owned memory pool, promotion queue, capture database, or
repair ranking system.

## Context Management Boundary

Hermes owns live execution context for turns.

Prompt-time context management helps the agent stay oriented during active
work, but it is not durable Memory. Durable knowledge lives under the configured
Memory root and is maintained through the managed `memory` skill and file APIs.

## Storage Lifecycle

Runtime seeds:

```txt
MEMORY.md
USER.md
TAXONOMY.md
episodic/
```

Direct Memory edits and maintenance workflows append raw observations to
`episodic/YYYY-MM-DD.md`, promote stable knowledge into semantic pages, and
refresh L1 briefings only when the context should load at session start.

## Correction And Forgetting

Corrections are Memory edits. Forgetting is explicit archive, rewrite, or
delete work performed by agents through Tasks or operator-directed runs.

The Memory page reflects current filesystem state; it does not keep a second
copy.

## Maintenance

Maintenance is scheduled work, not a built-in Runtime subsystem.

Agents can run Memory extraction, dreaming, research, query, and cleanup
workflows. The main chat agent normally leaves capture to those workflows and
edits Memory directly only when the user asks to remember, forget, or update
durable context. Runtime exposes Memory readiness and browsing APIs so state can
be inspected from Tavern.
