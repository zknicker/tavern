# Context Management

Context management is the bounded prompt context an active turn receives from
Hermes, Tavern chat state, participants, activity, and selected Memory material.

It is not a durable memory system. It is prompt assembly over existing sources.

## Source Boundaries

| Source | Owner | Role |
| --- | --- | --- |
| Hermes context management | Hermes | Prompt-time continuity during active turns |
| Chat and activity state | Tavern Runtime | Recent product state and live work |
| Participant state | Tavern Runtime | Active people and observed source labels |
| Memory | Runtime APIs, managed `memory` skill, and agent file tools | Durable Markdown knowledge |

Context reads from these sources and renders a bounded prompt-facing view. It
does not persist a synthesized bulletin as canonical memory.

## Assembly

The prompt-facing context can include:

* active chat and session orientation
* relevant recent activity
* active participant context
* Hermes prompt-time context
* selected Memory files or search results

Each piece is bounded and source-linked. If Memory has no useful result, the
context omits Memory material instead of adding filler.

## Constraints

* Prompt context stays bounded.
* Managed Tavern Hermes does not use Lossless Claw.
* Memory remains the durable knowledge system.
* The Memory page browses Memory files; it is not a separate store.
