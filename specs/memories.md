# Memories

Memory in Tavern is Cortex.

Tavern does not have two memory systems. Cortex is the durable memory system:
compiled truth, timelines, pages, embeddings, links, observations, capture
output, recall audit, and repair state.

Managed Tavern OpenClaw does not use Lossless Claw. Prompt-time context is
separate from Tavern memory, and durable memory lives in Cortex.

The Memory product surface is the readable inspection and control surface for
durable Cortex memory.

## Context Management Boundary

Managed OpenClaw keeps OpenClaw-native memory disabled. Tavern enforces that
setup as part of managed OpenClaw config rather than treating it as
user-authored memory state.

Tavern's managed OpenClaw memory config:

* sets `plugins.slots.memory` to `none`
* removes stale managed memory plugin entries such as `lossless-claw`,
  `active-memory`, and `memory-core`

The flat legacy `memory` runtime capability may still report this OpenClaw
context-management readiness until the runtime capability is renamed. Product
copy should describe it as context management, not memory.

## Durable Memory

Cortex pages hold the current best understanding in compiled truth and preserve
the evidence trail in timelines. Facts, preferences, decisions, identity,
events, observations, goals, and tasks are represented as Cortex page types,
frontmatter, tags, links, timeline entries, and source metadata.

Tavern does not add a parallel `memory_records` table for normal memory. If a
user corrects memory, Tavern edits or appends to Cortex. If a user forgets
something, Tavern marks, rewrites, archives, or deletes the relevant Cortex
material with audit history.

## Memory Inspection

The Memory page shows:

* recent Cortex captures
* compiled-truth changes
* appended timeline evidence
* Cortex recall results returned to agents
* failed captures and recall errors
* stale embeddings and repair state
* prompt-facing context or bulletin previews when available
* context-management readiness when prompt-time continuity affects memory use

Memory inspection favors readable evidence over graph visualization as the
primary experience.

## Person Memory

Person memory uses Tavern participants and profiles before writing to Cortex.

1. Observe a structured source identity such as provider, account scope,
   external user id, and display name.
2. Resolve that source identity to an observed participant.
3. Resolve manual profile links when present.
4. Write person knowledge into Cortex with participant/profile provenance.
5. Keep the observed participant as source evidence.

This keeps one Discord room with many humans from collapsing into one sender
label, and it lets one real person be linked across Tavern, Discord, Telegram,
and other surfaces without unsafe automatic merges.

## Prompt Continuity

The prompt-facing bulletin is a rendered context output, not the memory store.

It can include:

* stable identity context
* recent working memory synthesized from activity
* activity map
* participant context
* relevant Cortex compiled truth or recall output

The bulletin remains bounded. It must not become a dump of every hot Cortex page
or every recent recall result.

## Constraints

* Memory must not cause one agent's context to bleed into another agent.
* Person context must not leak into unrelated participants.
* Memory must stay bounded in prompt usage.
* Cortex provenance must make remembered context inspectable.
* OpenClaw context management and Cortex memory must remain separate readiness
  signals.
