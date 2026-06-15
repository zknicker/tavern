# Memories

Memory in Tavern is Cortex wiki plus prompt-time context.

Durable knowledge lives in the Cortex wiki hub. Tavern Runtime exposes that hub
through the Cortex API and Cortex tab, but it does not own a separate memory
database.

Managed Tavern Hermes does not use Lossless Claw. Prompt-time context is
separate from durable wiki knowledge.

## Durable Knowledge

Wiki topics hold source material, compiled pages, inventories, datasets, inbox
notes, and outputs as plain Markdown. Agents use the managed `cortex-wiki` skill to create and
maintain those files.

Tavern does not add a parallel `memory_records` table for normal memory. If a
user corrects memory, an agent edits the relevant wiki page. If a user forgets
something, an agent archives, rewrites, or deletes the relevant wiki material.

## Memory Inspection

The Memory page shows wiki readiness and counts. The Cortex page is the browsable
wiki surface.

The inspection model favors readable Markdown over graph visualization,
embedding settings, hidden repair queues, or generated schema controls.

## Person Memory

Person knowledge uses Tavern participants and profiles for identity, then stores
durable facts in wiki pages when an agent intentionally writes them.

Observed participant labels remain source evidence. Tavern does not merge
people by display name, and wiki facts should cite the participant/profile source
when identity matters.

## Prompt Continuity

Prompt-facing context is rendered from live state and selected source material.
It can include stable identity context, recent activity, participant context,
Hermes prompt-time context, and relevant wiki pages.

The prompt view remains bounded. It must not become a dump of every wiki page or
every recent search result.

## Constraints

* Memory must not cause one agent's context to bleed into another agent.
* Person context must not leak into unrelated participants.
* Prompt context must stay bounded.
* Durable knowledge remains inspectable as Markdown.
* Hermes context management and wiki readiness remain separate signals.
