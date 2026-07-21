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
- `pendingTurns`: total unsettled turns across all chats — the queue-depth
  hint behind "wrapping up in <chat>, and N others".
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
- **Sidebar rows**: each row's right edge carries its indicators; rows show
  no relative-time or "no activity yet" text.
  - Every chat kind shows an unread pill when the operator's read receipt
    (runtime `chat_reads`, reader `usr_tavern`) trails the newest message
    the operator did not author. Viewing a chat marks it read — on open and
    on each new message while open — via `chat.markRead`, which the runtime
    resolves read-to-latest at write time.
  - Agent DM rows anchor a presence dot to the agent face: green while the
    agent is idle, easing to amber while it is busy anywhere (agent
    presence, plus this chat's local optimistic turn). No spinner — motion
    at rest in the sidebar reads as distraction — and the dot stays off
    the right edge so it never crowds the unread pill.
  - Channel rows never show a presence indicator: agent-global busy
    lighting every channel the agent sits in reads as noise, and the DM
    list already is the busy roster.

## Non-goals

- Micro-states ("Running tools", "Reading files") — coarse busy/idle only;
  the live turn narration already exists for the active chat, and the
  [activity feed](agent-activity.md) covers "what has it been doing" at
  turn granularity.
- A standing agent presence rail or ticker: agents and built-in DMs are
  one-to-one, so the DM list already is the presence roster. The
  bottom-of-sidebar activity strip (specs/raft-alignment, I1) is the one
  exception — it renders only while an agent is mid-turn and disappears at
  idle, so at rest the DM list remains the sole presence surface.
- Presence for external/observed participants.
