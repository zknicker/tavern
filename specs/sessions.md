# Sessions

Sessions are Tavern's per-agent execution records inside chats, backed by observed runtime state.

## Product Boundary

- Tavern defines the session surface it presents.
- The owning runtime is canonical for native execution history.
- Session logs, relationships, deliveries, and navigation should feel like one coherent Tavern
  model rather than a leaked runtime-specific UI.
- Sessions are first-class, but they are not the primary shared conversation surface. That role
  belongs to chats.
- A session is not the same thing as a worker.

## Primitive Definitions

- `Chat` is the durable conversation container.
- `Session` is one agent's concrete participation in one chat.
- `Turn` is one execution inside a session.
- One chat may contain many sessions over time.
- One chat may contain many sessions at the same time when multiple agents participate.

## Session Identity

- A session has a stable session key, title, platform, agent, runtime, and start time.
- For OpenClaw-backed sessions, Tavern uses the OpenClaw `sessionKey` directly as the Tavern
  session key. Tavern APIs that fetch, resync, route, or send to a session name this input
  `sessionKey`.
- The session key is the durable conversation bucket and routing identity. It is not the session id.
- For OpenClaw-backed sessions, Tavern `session.id` is the OpenClaw `sessionId`.
- OpenClaw `sessionId` is the current transcript identity behind the key and may rotate when
  OpenClaw starts a fresh transcript for `/new`, `/reset`, daily reset, or idle reset. Tavern stores
  it as the session id and uses it for transcript attribution, not for routing.
- Multiple sessions may participate in the same chat.
- A session may have related runs, deliveries, child sessions, tools, and artifacts.
- Tavern may keep an active-session head for each `(runtime, chat, agent)` pair when the runtime
  exposes enough data to resume or identify continuity.

## Session Log

- Every synced session should have a detailed log when the runtime exposes messages or events.
- The session log should include normal messages and important non-message interactions.
- The session log should make tool use, deliveries, access failures, thinking, and artifacts easy
  to distinguish from normal chat text.
- Message attachments use Tavern's canonical attachment union:
  `inline` attachments carry embedded base64 payloads, while `file` attachments carry runtime file
  references such as paths or file URIs.
- Older runs and interactions should not disappear just because a newer sync happened.

## Navigation

- A person inspecting a session should be able to jump to related sessions, cron runs, and
  delivered messages when those relationships are known.
- A session should surface enough relationship information that a person can understand why a
  message or interaction happened.

## History

- Session history is observed runtime history.
- Tavern may keep observed session history available when the runtime is offline.
- Tavern does not delete session history by absence unless the runtime explicitly reports an
  authoritative deletion for that history scope.
