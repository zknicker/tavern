---
summary: Agent chat experience for durable messages, responses, activity, artifacts, receipts, offline catch-up, optimistic rows, and rendering rules.
read_when:
  - changing the main agent conversation experience
  - changing durable messages, responses, activity, artifacts, receipts, or timeline recovery
---

# Chat

Chat is Tavern's primary workspace. Users talk to one or more agents, watch work
happen, and keep the durable timeline as context.

## In the box

* **Durable messages.** User, assistant, and system rows are stable history.
* **Responses.** Agent work is grouped as a response to a message, with durable
  status from queued through completion or failure.
* **Activity.** Tool calls, thinking summaries, commands, approvals, snippets,
  and generated outputs render while work is happening and after completion.
  Tool rows label intent only (command, path, target — never results), stay
  neutral when completed, turn red on failure, and shimmer while running.
  Every contiguous tool group renders as a collapsed work drawer from its
  first step; the header shows the active tool's icon and synopsis while
  executing and a count summary at rest ("Ran 2 commands, searched web 1
  time"), so mid-turn growth only retexts the header. Expanding reveals the
  tool rows; clicking a row opens the tool-aware inspect drawer (see
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
* **Mid-turn steering.** The chat composer stays available while an agent turn
  is running. Drafts entered during an active turn are queued for the same chat
  and agent, then sent when the active response settles. Explicit steering and
  stopping are separate controls.
* **Composer context.** The composer keeps a compositional input shell with
  tool, model, attachment, queue, and submit slots. Attachments and per-chat
  model choices are Tavern controls backed by managed Hermes capabilities and
  config, not direct app calls into Hermes internals.
  Users can pick or drag files into the composer. Durable chat messages store
  attachment arrays.

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

## Live turn presentation

* The runtime coalesces stream writes: reply text publishes at most every
  ~60ms and activity writes at most every ~200ms, with flushes at segment and
  turn boundaries.
* Streamed reply text reveals at a paced rate (capped, never snapping), keeps
  revealing after the turn completes, and renders the same inline markdown as
  the durable message so completion does not reflow.
* The streamed reply and its durable message share one React key
  (`reply:<runId>`), so the end-of-turn swap does not remount.
* Intra-turn text segments move into the work log as narration rows when a
  tool follows; only the live tail (status indicator or streaming text) and
  the durable reply occupy the slot below the work disclosure.
* The "Working for" timer counts from message send while live; completed turns
  show the durable activity span ("Worked for").
* The work disclosure is open while a turn runs and collapses with an
  animation shortly after the response lands. Completed turns start collapsed.
* Step enter animations are tied to DOM insertion during a live turn
  (`@starting-style`), not to step status, so fast tools still animate and
  history never replays.
* One scroll controller owns the viewport's scroll position
  (`use-chat-scroll-controller.ts` over the pure mode machine in
  `chat-scroll-mode.ts`): `following` pins the bottom on content growth,
  `anchored` pins a disclosure trigger during manual toggles and releases when
  the panel's height transition ends (time fallback under reduced motion), and
  `free` leaves the user reading history with virtualizer compensation only
  for items resizing above the viewport. User wheel or touch input cancels an
  anchor. Deep components reach the controller through React context, never
  window events.

Queued composer drafts are app-local until dispatched. A queued draft does not
create a durable Tavern message, response, Hermes session entry, or transcript
row until Runtime accepts it through the normal send path. The queued draft
keeps its selected agent, attachments, model override, content, and metadata.

When Hermes accepts an explicit mid-turn steer, Runtime records a
`runtimeNotice` activity row. Tavern App renders it as a system row in the same
notice style as runtime session and compaction notices.

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
  activity and renders as a tool row with inline Approve/Deny actions
  (`chat.approval.respond` → Runtime → engine gateway). The row shows the
  waiting shimmer until the agent resumes; approving runs the command once,
  denying blocks it. An unanswered prompt times out engine-side and the turn
  continues as denied.
* **Typing indicator.** The live tail flips Thinking → Typing when the engine
  dispatches a message, and back to Thinking while visible work (reasoning,
  tools) is still arriving before reply text streams.

## Pinned chats

Pinned chat state is durable Tavern Runtime chat state. It survives app
reinstall and syncs through the normal chat list/detail reads. Pinning changes
tab grouping only; it does not change chat membership, message ordering,
response delivery, or archive behavior. Pinned tab color is durable Tavern chat
metadata. Pinned chats can also carry trusted system prompt text that Tavern
passes through the Hermes turn adapter for that chat.

## Contract

The feature contract lives in [Chat API](../api/chat.md).
