# Memory Lifecycle

Tavern memory lifecycle has two layers: compact assistant memory and the Vault
wiki.

There is no Tavern-owned memory pool, promotion queue, capture database, or
repair ranking system. Durable inspectable knowledge lives as Markdown in the
Vault wiki.

## Context Management Boundary

Hermes owns live execution context for turns.

Prompt-time context management helps the agent stay oriented during active
work, but it is not Tavern memory. Managed Tavern Hermes keeps native
`MEMORY.md` and `USER.md` memory enabled for compact hot facts and installs
the managed `vault` skill for durable knowledge work.

## Wiki Lifecycle

Vault workflows own durable knowledge files under the configured root:

```txt
INDEX.md
Daily/
System/
projects/example.md
research/example/...
```

Agents write and maintain those files through the managed `vault` skill. Tavern Runtime
does not run a hidden capture, recall, embedding, or repair pipeline.

## Correction And Forgetting

Corrections are wiki edits. Forgetting is explicit wiki archive, rewrite, or
delete work performed by agents through Tasks or operator-directed runs.

The Vault tab reflects the current wiki state; it does not keep a second copy.

## Maintenance

Maintenance is scheduled work, not a built-in Runtime subsystem.

Agents can run wiki research, query, and output workflows. Runtime exposes
Vault readiness and browsing APIs so wiki state can be inspected from Tavern.
