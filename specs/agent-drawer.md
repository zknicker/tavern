---
summary: Agent drawer — read-only view of an agent's global session facts and past sessions.
read_when:
  - changing the agent drawer, agent avatar click targets, or agent session UI
  - changing session reset behavior or the new-session notice
  - considering a new per-agent chat action (model switch, stats, controls)
---

# Agent Drawer

Clicking an agent's avatar in a chat opens a right-side drawer with that
agent's identity and its global Agent session. The drawer is read-only:
agents own one ongoing session across all chats
([sessions](sessions.md), ADR 0011), so session actions are agent-wide and
live in Agent settings, not on a chat surface. This surface replaced
composer slash commands (`/new`, `/clear`, `/status`), which could not
express a target in multi-agent chats.

## Opening

- Every agent avatar in the chat participant facepile (room topbar and
  browser toolbar) is a button labeled `Agent details: <name>`.
- Human participants are not clickable; the drawer is an agent surface.
- The drawer shows the agent's global session — the same session backs every
  chat the agent sits in. Global configuration and session resets stay in
  Agent settings.

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
  `turnCount`) from the session's durable turn evidence across all chats: the
  turn executor captures harness usage from the stream's final step and
  persists it as `metadata.runtime.contextTokens` on the completed response.
  Dismissed responses drop out of the stats.
- **Instructions freshness.** Instructions are delivered to an executor
  session once, at its first turn; changes land on the next session. Runtime
  fingerprints the delivered instructions (excluding core memory files, which
  extraction rewrites constantly) and the session read returns
  `instructionsFresh`: null when nothing has been delivered yet, false when
  the live compose no longer matches. When false, a warning notice card
  ("System prompt updated. This agent's system prompt has changed since this
  session started. The session picks it up after the next session reset or
  model change.") sits below the session card. Fresh sessions render nothing
  extra.
- **Past sessions.** The agent's earlier sessions as a high-level list,
  newest first: model, turn count, and when each ended ("ended 2h ago";
  stopped sessions say "stopped"). Served as `pastSessions` summaries on the
  same read — never the sessions' resume state. Hidden when the agent has no
  history.

## Session resets

Resets are agent-wide and live in Agent settings (Session section), not the
drawer: **Start fresh session** archives the current session and the next
generation becomes current on the agent's next turn; **Full reset** also
wipes the agent's workspace behind a destructive confirm. Both proxy to
Runtime `POST /agents/{agent_id}/session/reset` with
`{ kind: 'session' | 'full' }` and land a durable `new_session` runtime
notice (`metadata.runtime.notice`, `source: 'session-reset'`) in the agent's
DM. See [sessions](sessions.md) for the full reset contract.

Session identity stays Runtime-owned: the app never invents session ids and
never calls the engine directly.

## Contract

- The drawer is read-only. Reads must not mutate: showing the drawer never
  creates, resumes, or rotates a session.
- Session actions are agent-scoped and live in Agent settings. There is no
  composer command palette; a leading `/` is plain message text.
- The reset notice is durable evidence, keyed like any response: it survives
  reloads and offline catch-up.
- Historical composer-command evidence (activity kind `command`, response
  source `command`) may exist in stored chats. It is no longer rendered and
  never drives failed-turn banners; it stays durable.

## Future Work

- Cross-chat agent stats (sessions, chats, memory counts) in the drawer
  header.
