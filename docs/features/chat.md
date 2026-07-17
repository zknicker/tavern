---
summary: Agent chat experience for durable messages, responses, activity, artifacts, receipts, offline catch-up, optimistic rows, and rendering rules.
read_when:
  - changing the main agent conversation experience
  - changing durable messages, responses, activity, artifacts, receipts, or timeline recovery
  - changing busy delivery, the freshness gate, or stop behavior
---

# Chat

Chat is Tavern's primary workspace. Users talk to one or more agents, watch work
happen, and keep the durable timeline as context.

## In the box

* **Durable messages.** User, assistant, and system rows are stable history.
* **Responses.** Agent work is grouped as a response to a message, with durable
  status from queued through completion or failure.
* **Activity.** Tool calls, Widgets, thinking summaries, commands,
  snippets, and generated outputs render while work is happening and after completion.
  Tool rows label intent only (command, path, target — never results), stay
  neutral when completed, turn red on failure, and shimmer while running.
  Every contiguous tool group renders as a collapsed work drawer from its
  first step. The header shows a stable work summary, such as "Read 2 files,
  searched code" or "Rendered a calendar event". It can show
  a short useful command or target, but noisy commands and search payloads stay
  inside the drawer. If an intermediate tool fails and later work continues, the
  header scopes that as recovered tool work instead of making the final reply
  look failed. Active headers latch meaningful copy and animate short text
  changes, so rapid tool progress does not flash between raw commands and
  generic "Working" text. Expanding reveals the tool rows; clicking a row opens
  the tool-aware inspect drawer (see
  [Tool Presentation](../internals/tool-presentation.md)). Model thinking text
  lives in the turn details drawer alongside tool rows — its group header
  carries an icon like tool groups — and never renders in the chat pane.
* **Changed files.** A turn that creates, modifies, or deletes workspace files
  shows a "Changed N files" chip under the agent's reply in the chat (and the
  matching row in the turn drawer's work group). Opening it lists the files
  with per-file diffs (before/after text, bounded; binary files show a changed
  badge). Selecting text in a diff, workspace file preview, or Wiki page in
  the artifact pane offers "Quote in chat", inserting the quoted lines plus a
  `tavern://` source link into the composer — the universal review gesture.
* **Artifacts.** Code, images, files, diffs, documents, and charts render as
  durable outputs attached to messages or response activity.
* **Receipts.** Message creation and assistant delivery are acknowledged by id.
* **Channels and DMs.** Channels and direct messages are durable chat rooms in
  the sidebar. Channels render with a hash icon and optional channel color.
  Opening a chat shows a room topbar with the chat name and current
  participants. Users create channels by naming the channel and choosing its
  agent participants, and can edit channel participants from the open channel.
  Archive channel is an explicit menu action that hides the channel from the
  sidebar without deleting history. The sidebar's Archived entry opens the
  archived chats view (`/chats/archived`), grouped by chat kind, where any
  archived chat can be reopened or restored. An open archived chat shows an
  Archived badge and a restore bar in place of the composer. New workspaces
  start with no user channels. Each agent has one
  built-in DM with the local human operator. Agent DMs are not user-deleteable;
  deleting the agent removes its built-in DM from the sidebar. There is no
  separate pinned-chat state.
* **Chat appearance and instructions.** Tavern chats can carry durable channel
  color and trusted chat-specific agent instructions.
* **Offline catch-up.** Tavern Runtime keeps chat history while the app is
  closed; the app reloads from durable rows and refetches on reconnect.
* **Conversation vs. evidence.** The chat timeline carries conversation units
  only — messages, widgets, artifacts, notices. An agent's turn is one comment
  evolving in place: latest narration until reply text streams, then the
  reply, swapped for the durable message at completion. Execution evidence
  (tools, reasoning, narration history, workers) lives behind the turn
  drawer's per-turn query. See [chat-timeline](../../specs/chat-timeline.md).
* **Concurrent turns.** Live turn state is plural end to end: each agent seat
  runs one turn at a time, so a multi-agent channel legitimately carries
  several concurrent live replies. The app models `activeReplies`,
  `activeTurns`, and `failedTurns` keyed by run, the `chat.log.list` page
  carries the same plural shape, and each live reply renders its own
  streaming turn entry and status row. Failure banners are per agent seat: an
  agent's failure stays visible until that agent runs again, regardless of
  what other agents do in the chat.
* **Sending during live turns.** The chat composer stays available while
  agent turns run, and sending is always a normal send: the message lands
  durably and Runtime attempts busy delivery — a compact notice into each
  running turn's engine session so agents can incorporate it before
  finishing (see [steering](../../specs/steering.md)). Nothing queues or
  blocks on a live turn. Explicit stopping remains a separate control —
  with concurrent runs the stop control stops every live run in the chat.
  A stopped turn settles as `cancelled`; late engine output from that turn
  is not delivered as the assistant reply.
* **Freshness gate.** A channel reply drafted while peer messages landed
  unseen is held once: the agent sees the new rows plus its draft and
  delivers, revises, or declines with `NO_REPLY`. This is what keeps
  several agents from piling identical answers onto one message.
* **Agent-to-agent delivery.** Agent sends ride the same rails: a
  `chat_send` post is durable, busy-delivers to running turns, and
  dispatches evaluation turns when the sender's turn completes.
  `chat_wait_idle` waits, bounded, for a seat to go idle, and when a turn
  an agent's message dispatched settles, the sender receives a compact
  outcome note in its next prompt. See
  [addressing](../../specs/addressing.md).
* **Composer context.** The composer keeps a compositional input shell with
  attachment and submit slots. Agent model defaults live in Agent
  settings. Users can pick or drag files into the composer. Durable chat
  messages store attachment arrays.
* **Triggers.** `@` autocompletes Agents in the current chat; `$`
  autocompletes skills. A leading `/` is plain message text — session reset
  actions live in agent settings. See [mentions](../../specs/mentions.md)
  and [agent-drawer](../../specs/agent-drawer.md).
* **Addressing.** Every agent participant evaluates every channel message —
  each seat gets its own turn and chooses whether to speak. Mentions set
  who is expected to answer; they never gate who evaluates or who can read.
  Agent DMs address the one agent participant. See
  [addressing](../../specs/addressing.md).
* **Agent handoffs.** An agent's delivered final reply dispatches
  evaluation turns on the other seats the same way, bounded by chain depth
  and budget limits; mentioning a peer marks it as the expected owner.
* **Cross-chat posts.** An agent can post a message, as itself, into another
  chat where it holds a seat (`chat_send`, with `chats_list` for targets).
  The post starts no turn for its author; every agent seat of the target
  chat evaluates it once the posting turn completes — the
  consult-an-agent-elsewhere path, bounded by the same chain limits as
  in-chat handoffs.
* **Silent replies.** An agent can decline to respond: a turn whose reply is
  exactly `NO_REPLY` completes without delivering an assistant message. The
  response settles as completed with a "Chose not to reply" summary and
  activity row, so the turn drawer still shows the agent saw the message.
  Channel agents are taught this; the token is honored in every chat kind.
* **Agent drawer.** Clicking an agent avatar opens a read-only drawer with
  the agent's global session (model, status, timing) and past sessions.
  Session resets live in agent settings and are agent-wide
  (specs/sessions.md); a reset lands a durable new-session notice row in the
  agent's DM. In chat panes that notice never renders standalone — it
  attaches to the agent's next turn as a hover affordance in the turn's
  header actions. See [agent-drawer](../../specs/agent-drawer.md).
* **Dismissal.** Failed-turn banners can be dismissed with a hover X. The
  dismissal soft-deletes the durable row in Tavern Runtime — sequence slots
  and history records are retained, and the result syncs to every client.

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
* Assistant progress narration (preamble and intra-turn updates) renders
  through one replace-in-place slot per run: each new update replaces the
  previous one with the paced text reveal, and the run's final reply replaces
  the last update. Completed turns show only the final reply in the chat pane;
  the full narration history stays in the turn details drawer.
* The chat pane never reflows for turn lifecycle alone: the detail surface
  reserves the active-status row's space permanently (the indicator fades in
  place), and the live narration/reply slot holds the tallest height it has
  reached for the run so text swaps and the reply handoff never shrink the
  turn mid-stream.
* Agent turns render visible work and reply content in timeline order; there is
  no outer turn-level work disclosure. Per-tool work groups still own their
  existing drawers so detailed tool output stays available on demand.
* Active agent status renders as a compact stack at the bottom of the chat
  window, above the composer. Each row uses the agent's configured color and
  current expression, and stays out of the durable transcript. Rows animate in
  when a run starts and collapse out when it settles (reduced motion disables
  both); one send that targets several agents starts one optimistic row per
  agent under the run id the runtime will mint (`run_<message>_<agent>`), so
  the accepted turn updates the same row instead of duplicating it.
* Normal transcript loads mount durable history without entrance motion, and
  older pages loading in stay motionless. Messages that land at the live edge
  — local optimistic sends, other participants' messages, and agent replies
  that arrive without having streamed — use the chat bubble entrance
  animation; live tool step inserts keep their insertion-only step motion.
* While live, active status text sits next to the presence eyes in the bottom
  stack. The engine's status text is ignored. Completed turns remove the bottom
  status row.
* Stored model thinking renders inside the turn details drawer only. It does
  not render in the chat pane or as a separate presence bubble.
* Step enter animations are tied to DOM insertion during a live turn
  (`@starting-style`), not to step status, so fast tools still animate and
  history never replays.
* Sends append at the bottom of the transcript and never re-anchor the
  viewport: history above the new message stays where the reader left it, and
  the static bottom padding (clearance for the floating status stack) is the
  only reserved space. There is no send-time scroll-to-top or per-exchange
  runway.
* The detail transcript uses the shadcn Base UI chat components directly:
  `MessageScroller` owns pinned-end autoscroll, prepend preservation, scroll
  fades, and the latest-message button; transcript rows render as
  `MessageScrollerItem` plus the registry `Message`, `Bubble`, `Attachment`,
  and `Marker` primitives. Tavern does not layer a custom chat scroll
  controller or virtualized transcript over the shadcn scroller. Reopening a
  chat restores the remembered visible message through shadcn's scroller hooks;
  chats without remembered position open at the bottom.
* Agents and other people share one left-aligned roster layout: an avatar
  gutter, a bold name, a timestamp, then plain message text. The agent identity
  avatar is the Tavern eyes; a participant's avatar falls back to initials. The
  roster eyes avatar is static. The app owner's own messages (the local
  `usr_tavern` participant / `profile:self` actor) are the exception: they
  anchor to the right in an avatar-less secondary bubble. The owner's locally
  set name and avatar (Settings → Profile) apply where the owner is shown with
  identity.
* The left turn timeline rail summarizes loaded user-to-agent turns and marks
  the visible turn with shadcn visibility state. Selecting a rail mark jumps to
  that turn through shadcn `scrollToMessage`.

Sending never depends on turn state: every submit goes through the normal
message path whether the chat is idle or turns are live. Runtime attempts
busy delivery of the new message into each running turn and records a
"Delivered mid-turn" notice on the receiving response when the engine
accepts it (see [steering](../../specs/steering.md)); when it cannot, the
seat picks the message up through its next prompt's catch-up. There is no
composer queue and no steer window.

Stopping a live turn interrupts the managed engine session, keeps the session
busy until the engine reports the interrupted turn settled, then clears the
active response. The next user message starts only after that settlement, so the
stopped request remains historical context instead of the current instruction.
The cancelled response renders as a one-line stopped status row in the durable
timeline. The app may show that stopped row optimistically as soon as the user
requests a stop; if the stop request fails, the optimistic row is removed.

Busy-delivery and freshness-hold evidence (`runtime_notice_busy_delivery`,
`runtime_notice_freshness_hold`) render as regular runtime notice rows —
never user-styled — because the delivered message itself is already a
durable chat message. Historical `runtime_notice_steered` rows from the
retired steering feature render the same generic way.

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
* **Clarifications.** An agent question records as tool activity with
  clarification metadata and renders as a question row. Tavern does not pause
  the turn for inline answer controls; users can answer with a normal chat
  message when the answer belongs in the conversation.
* **Agent presence.** The latest agent turn shows the morphing agent eyes below
  the content, even at rest. The same shared-layout indicator remains 32px while
  the transcript places it under new work or reply text. The eyes use the
  agent's configured color, stay visible at rest, and live reply state plus
  active progress rows drive the expression.

## Chat Appearance

Channel color is durable Tavern chat metadata. It colors the channel hash icon
and supporting room chrome only; it does not change chat membership, message
ordering, response delivery, or archive behavior. Tavern chats can also carry
trusted system prompt text that Tavern passes through Runtime prompt
composition for that chat.

## Contract

The feature contract lives in [Chat API](../api/chat.md).
