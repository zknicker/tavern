# Memory Lifecycle

Tavern Memory has three layers:

* agent-local core memory files: `USER.md` and `MEMORY.md`
* hidden per-agent Episodic Memory extracted from chats
* shared Semantic Memory Markdown pages inspected in the app

There is no shared `USER.md` or shared `MEMORY.md`. Shared knowledge lives in
Semantic Memory.

## Context Management Boundary

Runtime owns live execution context for turns.

Prompt-time context management helps the agent stay oriented during active
work, but it is not Tavern Memory. Runtime injects the owning agent's
`MEMORY.md` and `USER.md` only when global Memory is enabled.

## Memory Lifecycle

Semantic Memory owns durable knowledge files under the configured root:

```txt
TAXONOMY.md
projects/example.md
research/example/...
```

Agents may write Semantic Memory when explicitly asked to remember or organize
shared knowledge, using the agent Memory tools. Extraction workers distill the
settled message window with the Fast model category and append the resulting
observations to hidden per-agent episodic evidence after completed turns and an
idle debounce. Dreaming workers promote stable evidence into the owning agent's
core memory files or shared Semantic Memory, and run only when that agent has new
evidence since its last dream.

## Correction And Forgetting

Corrections are direct Memory edits. Forgetting is explicit archive, rewrite, or
delete work. User edits and deletes are authoritative.

The Memory page reflects the current Semantic Memory files; it does not keep a
second copy.

## Maintenance

Maintenance runs through extraction, dreaming, and explicit agent Memory work.
Runtime exposes Memory readiness and browsing APIs so Semantic Memory can be
inspected from Tavern.
