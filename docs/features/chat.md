---
summary: Agent chat experience for durable messages, responses, activity, artifacts, receipts, offline catch-up, optimistic rows, and rendering rules.
read_when:
  - changing the main agent conversation experience
  - changing durable messages, responses, activity, artifacts, receipts, or timeline recovery
  - changing mid-turn queueing, steering, or stop behavior
---

# Chat

Chat is Tavern's primary workspace. Users talk to one or more agents, watch work
happen, and keep the durable timeline as context.

## In the box

* **Durable messages.** User, assistant, and system rows are stable history.
* **Responses.** Agent work is grouped as a response to a message, with durable
  status from queued through completion or failure.
* **Activity.** Tool calls, Rich Responses, thinking summaries, commands, approvals,
  snippets, and generated outputs render while work is happening and after completion.
  Tool rows label intent only (command, path, target — never results), stay
  neutral when completed, turn red on failure, and shimmer while running.
  Every contiguous tool group renders as a collapsed work drawer from its
  first step. The header shows a stable work summary, such as "Read 2 files,
  searched code", "Rendered a calendar event", or "Needs approval". It can show
  a short useful command or target, but noisy commands and search payloads stay
  inside the drawer. If an intermediate tool fails and later work continues, the
  header scopes that as recovered tool work instead of making the final reply
  look failed. Active headers latch meaningful copy and animate short text
  changes, so rapid tool progress does not flash between raw commands and
  generic "Working" text. Expanding reveals the tool rows; clicking a row opens
  the tool-aware inspect drawer (see
  [Tool Presentation](../internals/tool-presentation.md)). Model thinking text
  is hidden from the main chat transcript by default; Appearance settings can
  show it without changing the underlying runtime evidence.
* **Artifacts.** Code, images, files, diffs, documents, and charts render as
  durable outputs attached to messages or response activity.
* **Receipts.** Message creation and assistant delivery are acknowledged by id.
* **Chat tabs.** Pinned chats always appear first in the topbar. Unpinned chats
  appear only while locally open during the current app session, sorted by chat
  creation time. Restarting the app clears unpinned topbar tabs without
  archiving them. `Cmd+T` opens the new-chat surface; `Cmd+W` or a tab close
  button removes the current unpinned chat from the topbar. The overflow chat
  menu can reopen any non-archived chat.
* **Pinned chats.** Users can pin durable chats as focus-area homes. Pinned
  chats stay in the tab strip, survive app restarts, and can carry a custom
  tab color and chat-specific agent instructions.
* **Offline catch-up.** Tavern Runtime keeps chat history while the app is
  closed; the app reloads from durable rows and refetches on reconnect.
* **Turn timeline.** Loaded user-to-agent turns render as a compact hover rail
  beside the transcript, centered in the chat pane. Hover previews the user
  message, assistant reply or active status, and turn time. Selecting a dash
  scrolls the transcript to that turn without changing durable chat state.
* **Mid-turn steering.** The chat composer stays available while an agent turn
  is running. Drafts entered during an active turn are queued for the same chat
  and agent, then sent when the active response settles. A queued text-only
  draft can be steered into the active turn while that turn is still live;
  queued drafts with attachments or a model override stay normal next-turn
  messages because steering carries only text. Explicit stopping remains a
  separate control. A stopped turn settles as `cancelled`; late engine output
  from that turn is not delivered as the assistant reply.
* **Composer context.** The composer keeps a compositional input shell with
  tool, model, attachment, queue, and submit slots. Attachments and per-chat
  model choices are Tavern controls backed by managed Hermes capabilities and
  config, not direct app calls into Hermes internals.
  Users can pick or drag files into the composer. Durable chat messages store
  attachment arrays.
* **Triggers.** `@` autocompletes mentions (skills, plugins, apps, files,
  directories); `$` autocompletes skills only; a leading `/` opens the agent
  command palette and submits as a command run instead of a message. See
  [mentions](../../specs/mentions.md) and
  [composer-commands](../../specs/composer-commands.md).
* **Dismissal and clear.** Command cards and failed-turn banners can be
  dismissed with a hover X; `/clear` empties the visible timeline and starts
  fresh context. Both soft-delete durable rows in Tavern Runtime — sequence
  slots and history records are retained, and the result syncs to every
  client. See [composer-commands](../../specs/composer-commands.md).

## Timeline inputs

The timeline combines three inputs:

| Input | Owner | Role |
| --- | --- | --- |
| Durable messages | Tavern Runtime | Canonical timeline rows |
| Responses and activity | Tavern Runtime | Agent work and progress |
| Artifacts | Tavern Runtime | Rich renderable outputs |
| Optimistic local rows | App UI | One-frame accepted-message handoff |

Rendering rules:

* key user rows by durable message id
* key assistant rows by durable message id or delivery id
* key response rows by response id
* key activity rows by activity id
* open activity details by activity id, then load the durable row from the Chat API
* key artifacts by artifact id
* update running activity rows in place
* replace optimistic rows by durable message id
* recover reloads from Runtime messages, responses, activity, and artifacts

## App Data Flow

The app reads chat list and detail data separately. `chat.list` is the
lightweight ordered list contract for Tavern sidebars, overviews, and chat
pickers. Agent pages use `agent.chats.list` when they need the combined Tavern
and external runtime chat inventory.
`chat.get` is the focused detail read for a single chat. Timeline rows come from
`chat.log.list`, including durable messages, responses, activity, and artifacts.

Runtime progress and reply events update response and activity rows by stable
ids. They should not create a second volatile progress transcript.

The chat detail loads turn-aligned `chat.log.list` pages keyed by message
sequence and pages older history in as the user scrolls up. A page always
carries whole turn units — the user request, the response's activity, and the
reply — so partial work logs never appear at a page boundary, and rows carry
their owning `responseId` so transcript turn grouping uses server truth
instead of timestamp-gap heuristics. While a chat stays open, the loaded
transcript only grows:

* Live progress patches append rows; they never trim the loaded page.
* When a refetched tail window no longer covers a loaded row, the row is
  retained client-side. A full-coverage window stays authoritative for
  deletions; a deleted row inside a partial window disappears on the next
  chat open.
* Without this, a turn at the page limit visibly drains older expanded work
  drawers and restores them at completion.

## Live turn presentation

* The runtime coalesces stream writes: reply text publishes at most every
  ~60ms and activity writes at most every ~200ms, with flushes at segment and
  turn boundaries.
* Streamed reply text reveals at a paced rate while the reply is live.
  Completed handoff replies and durable history load full assistant text
  immediately without transcript entrance motion. The live reply renders the
  same compact chat Markdown as the durable message so completion does not
  reflow. Chat Markdown supports ATX heading markers with a compact H1-H3
  visual hierarchy, plus inline emphasis, strong text, code, and safe links.
* The streamed reply and its durable message share one React key
  (`reply:<runId>`), so the end-of-turn swap does not remount.
* Agent turns render visible work and reply content in timeline order; there is
  no outer turn-level work disclosure. Per-tool work groups still own their
  existing drawers so detailed tool output stays available on demand.
* The presence row stays below the latest agent turn at rest and while live.
  It keeps a fixed 32px icon box, uses the agent's configured color, and follows
  transcript reflow instantly as the turn grows.
* Normal transcript loads mount durable history without entrance motion. Local
  optimistic user messages keep the chat bubble entrance animation; live tool
  step inserts keep their insertion-only step motion.
* While live, an activity verb and timer sit next to the presence eyes. The live
  presence block slides and fades in when an idle chat starts a turn; completion
  keeps the eyes mounted and lets their normal idle transition run without an
  exit animation. Engine thinking status can rotate the themed verb during the
  turn; the engine's status text is ignored. Completed turns keep the eyes
  visible without timing text.
* Stored model thinking renders as normal transcript activity when the
  Appearance setting shows thinking text. Hidden thinking does not render as a
  separate presence bubble.
* Step enter animations are tied to DOM insertion during a live turn
  (`@starting-style`), not to step status, so fast tools still animate and
  history never replays.
* The full transcript virtualizes visible rows only: hidden thinking evidence
  does not reserve transcript height while the Appearance setting hides
  thinking text. TanStack Virtual owns follow-on-append, measured row size
  compensation, prepend anchoring, and pinned-end anchoring. Tavern leaves the
  library's default size-change adjustment in place so upward scroll input wins,
  and suppresses it only while disclosure anchoring is active. The local scroll
  controller tracks bottom state, latest-message requests, jump-button
  requests, and disclosure anchoring; virtualized detail chats delegate those
  bottom writes back to TanStack Virtual so there is only one measured-row
  writer. While the app is running, returning to a chat restores the first
  visible transcript row and offset unless the user last left that chat at the
  bottom, where it resumes following latest content.

Queued composer drafts are app-local until dispatched or explicitly steered. A
queued draft does not create a durable Tavern message, response, Hermes session
entry, or transcript row while it is only waiting in the composer. The queued
draft keeps its selected agent, attachments, model override, content, and
metadata.

The queued draft action follows the payload:

* text-only draft while a turn is active:
  hide the queued draft immediately, show the steered text in the chat, and
  call Runtime steering for the active run. Assistant progress and tool activity
  do not close this window. If Runtime rejects the steer or the call fails,
  restore the queued draft.
* text-only draft after the active turn settles: keep it as a normal queued
  draft for the next turn.
* draft with attachments or a model override while a turn is active: promote it
  to the queue head and stop the active run. After the stop settles, the draft
  sends through the normal message path so attachment staging and model
  selection still apply.
* any draft while the chat is idle: send it through the normal message path.

Stopping a live turn interrupts the managed engine session, keeps the session
busy until the engine reports the interrupted turn settled, then clears the
active response. The next user message starts only after that settlement, so the
stopped request remains historical context instead of the current instruction.
The cancelled response renders as a one-line stopped status row in the durable
timeline. The app may show that stopped row optimistically as soon as the user
requests a stop; if the stop request fails, the optimistic row is removed.

When Hermes accepts an explicit mid-turn steer, Runtime records a
`runtimeNotice` activity row with the steered text. Tavern App projects that
activity as a user-styled transcript row at the point it was accepted. It does
not render a separate steering system notice. The projected steer row is not a
durable Tavern message and does not change message counts or resend behavior.
The app may show the projected steer row optimistically while Runtime accepts
the steer, then remove it if Runtime rejects the call.

Other engine gateway signals surface the same way — as durable activity rows
that also patch live through `turn.progress` steps:

* **Agent notices.** Engine notices (for example credit warnings) record as
  `runtimeNotice` activities; a matching clear completes the row. They render
  as the existing system notice rows, live and in history.
* **Workers.** Spawn-tree progress records one activity per worker keyed by
  the engine's stable worker id, with goal, model, status, token/cost rollups,
  and file lists preserved as `metadata.subagent` source facts. The server
  projects these as `worker` rows for the existing worker step; running
  workers count toward live group labels ("Working on …"). Rollups stay in
  metadata for Stats.
* **Tool approvals.** A pending approval prompt records an `approval`
  activity and renders in chat as a normal tool row using the requested
  command as its label. The response controls render as a separate chat-footer
  prompt (`chat.approval.respond` → Runtime → engine gateway), with once,
  session, always, and deny choices. The footer prompt previews the command,
  overlays the prompt bar, and blocks the composer until answered. The row
  shows the waiting shimmer until the agent resumes. An unanswered prompt times
  out engine-side and the turn continues as denied.
* **Clarifications.** A mid-turn agent question records as activity named
  `clarify` and renders with inline answer controls. The row supports choices,
  free-text Other answers, Skip, and a Runtime-owned timeout shorter than the
  engine wait. Answers flow through `chat.clarification.respond` and the row
  settles as answered, skipped, or timed out.
* **Agent presence.** The latest agent turn shows the morphing agent eyes below
  the content, even at rest. The same shared-layout indicator remains 32px while
  the transcript places it under new work or reply text. The eyes use the
  agent's configured color, stay visible at rest, and live reply state plus
  active progress rows drive the expression.

## Pinned chats

Pinned chat state is durable Tavern Runtime chat state. It survives app
reinstall and syncs through the normal chat list/detail reads. Pinning changes
tab grouping only; it does not change chat membership, message ordering,
response delivery, or archive behavior. Pinned tab color is durable Tavern chat
metadata. Pinned chats can also carry trusted system prompt text that Tavern
passes through the Hermes turn adapter for that chat.

## Contract

The feature contract lives in [Chat API](../api/chat.md).
