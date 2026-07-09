---
summary: Agent drawer — per-chat agent details, current Agent session facts, and the New session action.
read_when:
  - changing the agent drawer, agent avatar click targets, or per-chat agent session UI
  - changing session reset behavior or the new-session timeline notice
  - considering a new per-agent chat action (model switch, stats, controls)
---

# Agent Drawer

Clicking an agent's avatar in a chat opens a right-side drawer with that
agent's identity, the seat's current Agent session, and session actions.
Actions on an agent always name their target by construction — the drawer is
scoped to one agent in one chat — so shared channels have no ambiguity about
which agent an action affects. This surface replaced composer slash commands
(`/new`, `/clear`, `/status`), which could not express a target in
multi-agent chats.

## Opening

- Every agent avatar in the chat participant facepile (room topbar and
  browser toolbar) is a button labeled `Agent details: <name>`.
- Human participants are not clickable; the drawer is an agent surface.
- The drawer is chat-scoped: it shows the `(agent, chat)` seat, not global
  agent settings. Global configuration stays in Agent settings.

## Content

- **Header.** The agent's face and name.
- **Session facts.** From `agent.session` (`GET
  /agent/chats/{id}/agent-sessions/current`, addressed by agent id): effective
  model and provider; context fullness (ring plus "12.4k of 200k", pairing the
  Runtime-reported `stats.contextTokens` with the model catalog's context
  window — plain token count when the window is unknown, hidden until a turn
  reports usage); turn count; started and last-activity relative times; and
  status only when it is not Active. The session's internal generation number
  never renders. No session yet reads "No session yet. The next message
  starts one."
- **Session stats.** Runtime aggregates `stats` (`contextTokens`,
  `turnCount`) from the session's durable turn evidence: the turn executor
  captures harness usage from the stream's final step and persists it as
  `metadata.runtime.contextTokens` on the completed response. Dismissed
  responses drop out of the stats.
- **New session.** A button that starts fresh context for this agent in this
  chat without clearing the chat.
- **Past sessions.** The seat's earlier sessions as a high-level list, newest
  first: model, turn count, and when each ended ("ended 2h ago"; stopped
  sessions say "stopped"). Served as `pastSessions` summaries on the same
  read — never the sessions' resume state. Hidden when the seat has no
  history.

## New session

1. The app calls `agent.resetSession` with the agent id and chat id.
2. The server proxies to Runtime `POST
   /agent/chats/{id}/agent-sessions/reset`.
3. Runtime rotates the seat's current Agent session: the active session is
   archived and a fresh session (next generation) becomes current, so the
   chat's next message opens a brand-new engine session. The timeline is
   untouched.
4. Runtime records the reset as durable chat evidence: one completed response
   holding a `new_session` runtime notice (`metadata.runtime.notice`) with the
   fresh session id, `source: 'session-reset'`. The app renders it through the
   existing runtime-notice row — the same row auto-rotation uses — so every
   client sees when fresh context started, durably.
5. The app invalidates the chat log and session snapshot; there is no toast.
   Failures surface inline in the drawer.

Session identity stays Runtime-owned: the app never invents session ids and
never calls the engine directly.

## Contract

- Agent-scoped session actions live on the agent object (the drawer), not in
  the composer. There is no composer command palette; a leading `/` is plain
  message text.
- The reset notice is durable evidence, keyed like any response: it survives
  reloads and offline catch-up.
- Reads must not mutate: showing the drawer never creates, resumes, or
  rotates a session.
- Historical composer-command evidence (activity kind `command`, response
  source `command`) may exist in stored chats. It is no longer rendered and
  never drives failed-turn banners; it stays durable.

## Future Work

- Cross-chat agent stats (sessions, chats, memory counts) in the drawer
  header.
