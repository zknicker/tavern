# Memory Context

Context management is the bounded prompt context an active turn receives from
Tavern chat state, participants, activity, Agent instructions, Memory, and
selected workspace material.

It is not a durable memory system. It is prompt assembly over existing sources.

| Source | Owner | Role |
| --- | --- | --- |
| Chat and activity state | Tavern Runtime | Recent product state and live work |
| Participant state | Tavern Runtime | Active people, agents, and observed source labels |
| Agent instructions | Tavern Runtime | Agent identity, behavior, skills, and tool guidance |
| Memory | Tavern Runtime | Durable inspectable knowledge |

Runtime controls the prompt budget and must keep context bounded.
