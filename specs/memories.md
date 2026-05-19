# Memories

Memory in Tavern is not a second durable database beside Cortex.

Tavern has two memory layers:

* **OpenClaw runtime memory.** Lossless Claw provides prompt-time recall during
  active OpenClaw turns.
* **Cortex.** Tavern's GBrain-style durable brain stores compiled truth,
  timelines, pages, embeddings, links, observations, capture output, recall
  audit, and maintenance state.

The Memory product surface is the readable inspection and control surface for
those layers.

## OpenClaw Runtime Memory

Managed OpenClaw uses Lossless Claw for prompt-time runtime context. Tavern
enforces that setup as part of managed OpenClaw config rather than treating it
as user-authored agent state.

Tavern's managed OpenClaw memory config:

* sets `plugins.slots.contextEngine` to `lossless-claw`
* sets `plugins.slots.memory` to `none`
* enables the `lossless-claw` plugin

The flat `memory` runtime capability reports this OpenClaw prompt-time memory
readiness.

## Durable Memory

Durable memory is Cortex.

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

* OpenClaw runtime memory readiness
* recent Cortex captures
* compiled-truth changes
* appended timeline evidence
* Cortex recall results returned to agents
* failed captures and recall errors
* stale embeddings and maintenance state
* prompt-facing context or bulletin previews when available

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

The prompt-facing bulletin is a rendered output, not the memory store.

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
* OpenClaw runtime memory and Cortex durable memory must remain separate
  readiness signals.
