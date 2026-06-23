# Context Management

Context management is the bounded prompt context an active turn receives from
Hermes, Tavern chat state, participants, activity, and selected wiki material.

It is not a durable memory system. It is prompt assembly over existing sources.

## Source Boundaries

| Source | Owner | Role |
| --- | --- | --- |
| Hermes context management | Hermes | Prompt-time continuity during active turns |
| Assistant memory | Hermes | Compact `MEMORY.md` and `USER.md` hot memory |
| Chat and activity state | Tavern Runtime | Recent product state and live work |
| Participant state | Tavern Runtime | Active people and observed source labels |
| Vault wiki | Managed `vault` skill and agent file tools | Durable Markdown knowledge |

Memory context reads from these sources and renders a bounded prompt-facing
view. It does not persist a synthesized bulletin as canonical memory.

## Assembly

The prompt-facing context can include:

* active chat and session orientation
* relevant recent activity
* active participant context
* Hermes prompt-time context
* assistant memory snapshot
* selected Vault pages or search results

Each piece is bounded and source-linked. If the wiki has no useful result, the
context omits wiki material instead of adding filler.

## Constraints

* Memory context stays bounded.
* Managed Tavern Hermes does not use Lossless Claw.
* Vault remains the durable knowledge system.
* The Memory page inspects wiki readiness; it is not a separate memory
  database.
* The Vault page browses wiki pages; it is not a separate store.
