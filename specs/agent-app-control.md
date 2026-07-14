---
summary: Capability parity audit — which user-facing app actions agents can perform, with the UI-intent channel as the shared mechanism for agent-driven app surfaces.
read_when:
  - adding or changing an agent tool that mutates app or UI state
  - deciding whether a user-facing capability should be mirrored to agents
  - changing UI intents, pane control, or agent-driven presentation
---

# Agent App Control

Tavern mirrors user capabilities to agents deliberately, one decision at a
time. This spec is the parity ledger: every user-facing action gets an
explicit agents-can / agents-can't / agents-propose decision here before a
tool ships. Default-no is a missing row, not a policy — when a capability is
requested and has no row, add the row and the decision together.

Two principles govern every "can" row:

1. **Runtime owns the mechanism.** Agent-driven app changes flow through
   Runtime-owned records and events, never through app-local side channels.
   The app renders what Runtime says happened, sync-first.
2. **Everything leaves evidence.** Every agent-initiated app change is
   recorded as response activity in the turn that caused it, inspectable in
   the transcript like any other tool call.

## The ledger

| Capability | Agents | Mechanism / rationale |
| --- | --- | --- |
| Read chat history (own chats) | Can | `chat_messages_*` tools, seat-scoped. |
| Send into other chats | Can | `chat_send`, seat-scoped; mentions dispatch per [agent-mentions.md](agent-mentions.md). |
| Create / rename / archive chats | Can't (revisit) | No workroom story yet; tracked work goes through Tasks. Revisit if dispatch needs agent-opened workrooms. |
| Join / leave chats, manage seats | Can't | Participant management is user-only; seats are trust grants. |
| Open artifacts in the chat's pane | Can | UI intents (below). First consumer: `pane_open` (PRD-46). |
| Arrange pane tabs (close, reorder) | Can't (v1) | Agents add and focus tabs; the user curates. Revisit with usage. |
| App settings (general) | Can't | Settings are user-only trust decisions; no settings tool group. |
| Own model / tool grants / web access | Can't | Self-escalation; grants stay user-only. |
| Own standing instructions | Can | Already true: `NOTES.md` and core memory files are agent-editable workspace files. |
| Skills (create, patch, files) | Can | Existing `skill_*` self-improvement loop. |
| Wiki (read, write, move, delete) | Can | Existing `wiki_*`, hash-guarded, Git-backed. |
| Automations (own jobs) | Can | Existing `cron_*`, scoped to the agent's own jobs. |
| Tasks (file, update) | Can | Existing `tasks_*`; backlog-only creation, user promotes. |
| File tasks into todo / dispatch | Can't | Triage and dispatch are user decisions. |
| Themes: author | Proposed | PRD-53. Agents author token-override files; validation-gated. |
| Themes: apply | Propose-only (default) | User applies from settings; optional per-user toggle may allow direct apply (PRD-53 decides copy and default). |
| Request secrets | Proposed | PRD-52. Blocking form; values never transit the model. |
| Send OS notifications | Can't (revisit) | No notification tool; cron delivery + chat mentions cover today's needs. |
| Configure other agents | Can't | Only work handoff via mentions; no create/configure/delete-agent tools. |
| Install / author plugins | Can't (decided) | Conflicts with ADR 0002 (explicit widget wiring) and ADR 0004 (plugins are settings-managed). Skills cover self-extension. |
| Rebind keyboard shortcuts, app layout | Can't | No product need; pure-delight surface area with real confusion cost. |

"Proposed" rows ship with their named PRD or not at all; this table is
updated in the same change that ships the tool.

## UI intents

A **UI intent** is a Runtime-recorded request from an agent turn to change
what a chat's presentation surfaces show. It is the single sanctioned channel
for agent-driven UI: new "agents drive the app" capabilities add intent kinds
here rather than inventing parallel paths.

Semantics:

- **Chat-scoped and seat-gated.** An intent targets one chat; the tool only
  accepts the agent's current chat, and the agent must hold a seat there.
- **Durable record, live event.** Runtime persists the intent's effect on the
  chat's presentation record (v1: the pane tab state) and emits a named
  domain event over the realtime contract. The app applies the change live
  when the chat is open and renders the persisted state on next open —
  intents are not lost while the app is closed.
- **Evidence row.** The tool call that raised the intent is stored as
  response activity like every other tool call; the transcript shows what the
  agent opened and when.
- **Requests, not commands.** The app owns presentation. It may decline an
  intent kind it does not support and renders persisted state on its own
  schedule; agents get a success result meaning "recorded", not "rendered".

v1 ships one intent kind: **open-pane-target** (open or focus a workspace
file or Wiki page tab in the chat's artifact pane), raised by the `pane_open`
agent tool. The tool takes a `tavern://workspace/<path>` or
`tavern://wiki/<path>` link for the current chat and appears in the tool
catalog as the Artifact pane group.

## Pane tab state

The artifact pane's tab set is a Runtime-owned per-chat record, not app-local
state:

- One record per chat: an ordered list of targets (workspace path or wiki
  path), the active target, and a monotonically increasing revision.
- User tab actions (open, close, focus) submit revision-guarded full-state
  writes; a stale write fails with the current state attached so the client
  converges without a refetch. Agent intents are atomic append-and-focus
  merge ops — commutative with user gestures, so they never conflict; every
  write bumps the revision.
- The pane stays chat-scoped per ADR 0004: switching chats switches records;
  nothing carries across chats. Tabs survive app reload because the record is
  Runtime state, not component state.
- Pane visibility is app-local presentation: the app may show the pane empty
  or hide it without touching the record. By default the pane shows whenever
  the chat has tabs.
- Workspace targets are confined to the owning agent's workspace; wiki
  targets must resolve to an existing page at write time. Invalid targets are
  rejected at the write, never rendered as broken tabs.

## Boundary

Tavern Runtime owns the parity ledger's enforcement, UI-intent records, the
pane tab state, and their events. Tavern App owns rendering, user tab
gestures, and the choice of how an intent is presented. Tools that raise
intents live with the other Tavern tool groups and appear in the tool
catalog and settings like any other group.
