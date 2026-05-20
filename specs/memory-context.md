# Context Management

Context management is the bounded prompt context an active turn receives from
OpenClaw, Tavern chat state, participants, activity, and Cortex recall.

It is not a durable memory system. It is prompt assembly over existing sources:

* Lossless Claw context management for prompt-time continuity
* current chat, session, and activity state
* participant/profile facts resolved by Tavern
* Cortex recall results for durable knowledge

## Source Boundaries

Each source keeps its own ownership.

| Source | Owner | Role |
| --- | --- | --- |
| Lossless Claw context management | OpenClaw | Prompt-time continuity during active turns |
| Chat and activity state | Tavern Runtime | Recent product state and live work |
| Participant/profile state | Tavern Runtime and Tavern App | Person identity and explicit links |
| Cortex | Tavern Runtime | Durable pages, observations, timelines, links, embeddings, and recall |

Memory context reads from these sources and renders a bounded prompt-facing
view. It does not persist a synthesized bulletin as the canonical memory.

## Assembly

The prompt-facing context can include:

* active chat and session orientation
* relevant recent activity
* active participant/profile context
* Lossless Claw prompt-time context
* Cortex recall results with source links

Each piece is bounded and source-linked. If Cortex recall returns nothing useful,
the context omits Cortex material instead of adding filler.

## Cortex Recall

Cortex recall is the durable knowledge path.

Agents use Cortex when durable knowledge can materially improve the response:
standing project facts, prior decisions, source notes, participant-relevant
knowledge, files, citations, and observations.

Recall returns page hits and evidence. The Memory page can show what was
returned, which source records backed it, and whether embeddings or maintenance
blocked recall.

## Capture Boundary

Compaction does not write durable memory.

When material is at risk of falling out of useful context, Tavern creates a
bounded capture boundary and writes it through the Cortex persistence pipeline.
The output is Cortex material: page updates, timeline entries, links, tags,
source metadata, citations, audit, and activity events.

## Constraints

* Memory context stays bounded.
* Lossless Claw remains prompt-time execution context.
* Cortex remains the durable memory and knowledge system.
* The Memory page inspects source-linked context use; it is not a separate
  memory database.
* The Knowledgebase page browses Cortex pages; it is not a separate store.
