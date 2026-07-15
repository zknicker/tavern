---
summary: Agent presence — one busy/idle fact per agent, projected from the turn queue and rendered wherever the agent appears.
read_when:
  - changing agent busy indicators, presence dots, or the busy-elsewhere composer hint
  - changing how turn state surfaces in the app outside the active chat
---

# Agent Presence

One agent owns one session and runs one turn at a time across all chats
([sessions](sessions.md)), so busyness is an agent-scoped fact: an agent
grinding in one chat is genuinely busy everywhere. Presence surfaces that
fact wherever the agent appears, so a send into any of its chats visibly
queues instead of silently waiting.

## Contract

Runtime projects presence from the turn queue — never stored, never
invented:

- `state: busy` when the agent has any unsettled turn (running or queued;
  queued counts so mid-drain gaps never flicker idle). Otherwise `idle`.
- `chatId`/`chatTitle`: the running turn's anchor chat, or the oldest
  queued chat while nothing runs. Title is presentation sugar so clients
  never join chats to render a status line.
- `since`: when the anchoring turn started (or was created, if queued).

Served at Runtime `GET /agents/presence` for every stored agent; the server
proxies it as `agent.presence`. Without a reachable Runtime every agent
reads idle — presence is volatile runtime state and degrades to absence,
never a stale cache. Turn start/settle events invalidate the query; there
is no per-token churn.

## Surfaces

- **DM topbar**: presence dot next to the agent's name — green idle (dot
  only, no text), amber busy with a label: "Replying…" when the turn is
  anchored here, "Working in <chat>…" when anchored elsewhere.
- **Busy-elsewhere composer hint**: when a seated agent's turn is anchored
  in a different chat, a quiet line above the composer — "<Agent> is busy
  in <chat> — your message is queued and answers next." Hidden the moment a
  turn runs in this chat; the active status stack ("thinking…") owns that
  state and is unchanged by presence.
- **Sidebar DM rows**: the presence dot rides the agent face; the existing
  per-chat turn spinner (driven by `activeTurnParticipantIds`, which is
  agent-global) stays the busy affordance on chat rows.

## Non-goals

- Micro-states ("Running tools", "Reading files") — coarse busy/idle only;
  the live turn narration already exists for the active chat.
- A separate agent presence rail or ticker: agents and built-in DMs are
  one-to-one, so the DM list already is the presence roster. A dedicated
  strip only earns its place if presence must stay visible in sections
  without the chat sidebar.
- Presence for external/observed participants.
