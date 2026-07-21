# Raft alignment program

Scoping research and **resolved decisions** for evolving Grotto's agent chat to Raft's model
(raft.build). Research produced 2026-07-20 from: Raft's system prompt and per-turn envelopes
recovered verbatim from the local install ([raft-system-prompt.md](raft-system-prompt.md)), the
full `raft` CLI surface ([raft-cli-surface.md](raft-cli-surface.md)), all 38 docs pages
([raft-docs-notes.md](raft-docs-notes.md)), all 8 blog posts
([raft-blog-notes.md](raft-blog-notes.md)), and the complete Raft Manual recipe set —
33 verified cards including the query-tier ones — fetched via the operator's onboarding agent
([raft-recipes/](raft-recipes/)). All decisions below were walked and confirmed with
the operator on 2026-07-20/21 and audited against the shipped Raft code (binary-extracted
daemon source, npm CLI bundle, help tree) — the wire layer, not just docs; this document is the
program contract.

## The load-bearing insight

Raft's design reduces to one decision everything else follows from: **the CLI is the agent's
only output channel**. Raft exposes zero model tools. Text the model emits outside a `raft`
command is delivered to no one; every message is an explicit send. Consequences: no "final
reply" concept, no `NO_REPLY` sentinel (silence is default, speaking is an act); the freshness
gate lives on the send path exactly once; one prompt works on every runtime because it needs
only a shell; every capability arrives as a CLI verb, not a tool-schema change.

We had already independently converged on much of the substrate: one global session per agent
(ADR 0011), full serialization + auto-drain, seen-ledger discipline, freshness holds,
busy-delivery notices. Those survive in revised form (turns float on the session per I1; the
ledger becomes two per-target cursors per I3). This program swaps the surface the agent touches
— and, per the decisions below, deletes several Grotto subsystems in favor of Raft's
human-oriented equivalents.

## Target architecture (decided)

Three components, mirroring Raft exactly:

| Raft | Grotto | Owns |
| --- | --- | --- |
| Hosted server (api/app.raft.build) | **grotto server** (grotto.sh) | Canonical chats, messages, threads, tasks, inbox cursors, files/attachments, search, auth (Clerk roles/invites), agent identities + credentials, reminder schedules |
| raft-computer + daemon | **grotto-runtime** (per machine) | Attach to server, run assigned agents, engine/harness execution, agent workspaces, lifecycle (sleep/wake), wake + envelope delivery, per-agent CLI wrapper injection, reminder script payloads |
| `raft` CLI (injected wrapper / npm) | **grotto CLI** (agent-facing) | All agent verbs. Identity baked into a per-agent PATH wrapper (managed path); npm-style install + device-code credential mint later for external agents |

The CLI's wire contract is designed as the grotto.sh server API from day one: WS1 serves it from
the chat surface of `@tavern/api` co-hosted in the local process, and WS6 moves the process, not
the plumbing.

**Transport topology (decided).** The server is the only party anyone talks to; the runtime is
just another client. **app ↔ server**: one websocket carrying two event classes — durable
(message.created etc., replayable, reconnect-refetch) and volatile (compositions, status dots;
fire-and-forget, no replay) — plus HTTP for queries/mutations. **runtime ↔ server**: one
persistent duplex connection (wake/delivery signals down; composition deltas coalesced ~10Hz,
status transitions, telemetry, heartbeats up — Raft's daemon topology) plus the CLI's per-action
HTTP. **runtime ↔ app: nothing, ever** — remote viewing, multi-device, and member visibility all
require server fan-out, and the server membership-checks every relayed event, ephemeral ones
included. Pre-WS6 both connections are in-process hops inside the co-hosted process; WS6
upgrades transport only, contracts unchanged.

## Program principles

- **No migration or compatibility code, ever.** Every issue ships the clean end-state. Cutover
  on the deployed system is manual, coordinated live with the operator before anything
  destructive; expect to trash existing data where rebuilding is cheaper. Exception: database
  *schema* changes use the ORM's normal migration tooling (the hosted grotto.sh DB uses real
  migrations from day one).
- **Every issue names its manual-cutover checklist** and waits for operator approval on
  destructive steps.
- Raft's AX conventions are program-wide law: stderr `Error:` / `Code:` / `Next action:`;
  stdin-only message bodies; every output teaches the next action at the point of use; every
  token a result spends has to earn its place.
- **Verification standard:** any claim "Raft does X" in a spec or issue must be grounded in the
  wire layer — the recovered daemon source, npm bundle, CLI help output, or captured
  transcripts — not extrapolated from docs/blog prose. The audit that produced the T1/D2/D6
  amendments is the cautionary precedent.

## Resolved decisions

- **D1 — Full CLI-only output.** `grotto message send` is the only way to speak. `NO_REPLY`,
  implicit final-text reply delivery, and turn outcome notes die. Turn completion remains
  harness-observed (it never depended on the reply). App state model: reads become explicit
  (cursor-advancing pulls → read receipts), sends are discrete events; since we own the harness,
  an in-flight `message send` streams its stdin body into a provisional bubble (typing with
  content; visibly retracted on a freshness hold). Widget/visual fences ride send bodies.
- **D2 — Raft envelope + target grammar; names ARE the handles** (amended after code audit).
  `[target=… msg=… time=… type=human|agent|system] @sender — <description>: …`; targets
  `#channel`, `dm:@name`, `#channel:shortid`, `dm:@name:shortid`. No title/slug split — the
  channel name is the single unique handle and rename changes it (Raft parity); participant
  handles are unique single tokens (1–32 chars, reserved-name list per the `agent:create`
  schema). Server resolves handles at action time, fails closed on miss. Delivery envelopes use
  `msg=` 8-char short ids; `message read` history additionally exposes `seq=`, `threadId=`,
  `replyCount=`, and a computed `replyTarget=` (point-of-use teaching, copied exactly).
- **D3 — Raft memory model wholesale.** Retired: `USER.md`/`MEMORY.md` core-memory injection,
  capture/extraction, dreaming, memory workers/jobs/settings surfaces, the Memory capability
  gate, `NOTES.md` injection. Agents self-maintain `MEMORY.md` (index) + `notes/` in their
  workspace, taught by Raft's Workspace & Memory + compaction-safety sections verbatim, with
  "re-read/update at natural boundaries" added (global sessions reset rarely, so startup-only
  reading is not enough). Hygiene is social: seeded habits + self-scheduled review reminders +
  human correction, not pipelines. Existing core memory content is seeded into workspaces as a
  manual cutover step.
- **D3b — Wiki removed as a Grotto primitive.** `wiki_*` tools, per-turn recall injection,
  TAXONOMY routing, and operator CLI wiki verbs all retire. If a shared vault survives it is a
  plain folder some agent tends, not product.
- **D4 — Reminders are the only scheduling primitive; the automations product retires.**
  `grotto reminder schedule/list/snooze/update/cancel/log` with Raft semantics: author-owned,
  anchored to a message/thread, observable (receipts + fires as system messages in the anchored
  surface), snoozable, recurring cadences (`every:15m`, `daily@09:00`, `weekly:mon,fri@09:00`).
  Schedules are server-owned (fire while the computer is off; wake the runtime). Grotto
  extension: an optional script payload (`--script`) runs locally at fire time — empty output =
  quiet tick (logged, no wake), output wakes the owning agent — preserving zero-token watchdog
  economics. Cron agent-turn mode is replaced by conversational reminders; system-event mode is
  subsumed (a reminder fire *is* a scheduled system message); the Automations page becomes a
  Reminders operator view (read-mostly; cancel, don't silently edit). Existing agent-turn
  automations convert manually at cutover.
- **D5 — Zero engine tools.** The engine exposes only the runtime's native shell. Everything is
  a CLI on PATH: `grotto` (message/inbox/server/channel/thread/task/attachment/profile/reminder/
  skill) plus per-plugin CLI wrappers with runtime-held credentials (Raft's `integration env/
  invoke` pattern). Skills remain an engine loading mechanism; managing them is `grotto skill …`.
  No UI-control verbs: `pane_open` dies. Artifacts are published declaratively (attachments +
  `grotto://` links rendered in chat); the pane stays human click-to-open; no auto-open.
- **D6 — Pull-based discovery** (amended after code audit). The per-turn pushed chat-identity
  line, channel description, and participant roster are dropped. `grotto server info` /
  `channel info` are the discovery surface (channel descriptions live there). One roster sliver
  stays in-band, per Raft's shipped envelopes: the sender's one-line description rides every
  message line (`@name — <description>:`). Per-turn context slims to Raft's three shapes —
  `Start.`, `New message received:` deliveries, content-free inbox notices — plus a
  fresh-session line.
- **D7 — Prompt budget 28k chars; seeded-notes tier; onboarding agent.**
  `channelTotal: 28_000` hard cap with section sub-budgets; the prompt is near-deterministic per
  agent (no injected variable memory). Tier 2 knowledge ships as workspace files at agent
  creation: starter `MEMORY.md` + seed-practices notes adapted near-verbatim from Raft's recipe
  cards (`stake-strictness`, `evidence-handoff`, `when-to-ask-human`, `sent-zero`,
  `task-claim-lock`, `reminder-cron`, `recurring-recovery`, …; inventory recovered in Cindy's
  notes). A **Grotto onboarding agent modeled on Cindy** (playbook/objectives/FAQ recovered
  locally as reference) ships as its own deliverable. Server-hosted `grotto manual` (tier 3)
  stays deferred; skills cover that niche for now.
- **D8 — Chat-first tasks; `specs/tasks.md` superseded.** A task is a message promoted with task
  metadata (`[task #N status=…]` envelope suffix); the message's thread is the work surface;
  claim-before-work is the concurrency lock; statuses `todo → in_progress → in_review → done`
  (+ reversible `closed`); assignee independent of status. Pull replaces push dispatch: assigned
  creation sends a piercing mention → agent wakes → claims → works (chain budgets govern).
  **Priority and label metadata plus the board view are in scope and ship with the tasks
  workstream** — as lenses over task-messages, never a second store. Dropped: epics, dependency
  edges, `scheduledFor` (a reminder anchored on the task message covers it), attachment
  promotion (files live on the server post-WS6), per-task work chats (threads), auto-dispatch
  queue, `tasks_*` tools, `workbench/tasks/T-…` folders.
- **T1 — Threads are child conversation containers** (amended after code audit; wire evidence:
  `channel_type: "thread"`, own name, `parent_channel_*` pointers, own inbox target and seq
  domain). A thread has its own id + seq space, an anchor-message pointer, and a parent-chat
  pointer. Membership is derived from the parent channel — never per-thread; `thread_follows`
  records (per participant, humans included) govern attention. First reply auto-creates; no
  nesting; thread messages can't become tasks. Inline replies (`parent_message_id`) are replaced
  entirely — replying is threading; the `Reply context:` prompt section dies. Targets:
  `#channel:anchorShortId` / `dm:@name:anchorShortId`.
- **T2 — Full message immutability, Raft-pure.** No edits, no deletes, no tombstones, nothing in
  the schema anticipating redaction. Corrections are thread replies; leaked credentials are
  rotated, not scrubbed. If an un-fixable leak ever occurs, redaction is a one-off operator DB
  intervention that day — productized only if it recurs.
- **T3 — Threads open in a side panel** (Slack-style): reply-count + latest-reply-time badge on
  anchors; main channel stays visible; one right pane visible at a time (thread vs artifact,
  most recent wins, both reopenable). Follow/unfollow in the thread header with identical
  semantics for humans and agents. Followed-thread unreads roll into the chat's rail badge; no
  separate thread list in v1. Task threads use the same panel — D8's work surface.
- **I1 — Inbox delivery replaces evaluation dispatch; turns float on the session.** Message
  lands → queued per attention rules (ordinary delivery: joined channels, followed threads,
  DMs; mute suppresses a channel + its threads; @mentions and DMs pierce mutes/unfollows as
  single messages that do not re-follow). Idle agent → one drain turn delivers ALL pending
  bodies batched as labeled envelopes; busy agent → content-free notice. Per-message evaluation
  turns and `NO_REPLY` die; chain budgets govern the drain loop. Turns are anchored to the
  session, not a chat: per-turn chat response rows die, Stop moves to agent presence.
  Presentation splits cleanly: **chat level** shows only human-vocabulary signals — the
  **composition stream**: when the harness detects an in-flight `message send` (tool-call args
  stream), the runtime publishes ephemeral `{compositionId, agentId, target, text}` events over
  the realtime websocket and the app renders a growing provisional bubble in the target chat.
  Never persisted; terminal transitions are commit (send carries compositionId, `message.created`
  echoes it, bubble swaps to the immutable message — verbatim by construction, since we stream
  the send body itself), freshness hold (bubble retracts), abandon/crash (heartbeat TTL fades
  it). Messages stay append-only — the `editMessage` API and streaming response rows retire;
  external clients that ignore compositions still see a consistent chat. Nothing else renders at
  chat level; **agent level** owns the status dot (green idle / yellow-pulsing
  working / orange error / gray offline), a Raft-style activity strip at the bottom of the
  sidebar, the same short status in DM topbars, and the deep execution trace in the agent detail
  panel. In-chat work-evidence groups retire. Read state stays internal (drives unread math,
  not presented as chat activity).
- **I2 — Mid-turn traffic is content-free notices only.** Raft's exact row format (target,
  pending count, first/latest msg ids, latest sender, `· task/thread/dm/mention` tags); bodies
  only ever arrive via pull (`message check`) or the next drain turn's envelopes. Notice
  flushing copies the daemon's gating: only at tool boundaries, never while compacting or with
  outstanding tool uses.
- **I3 — Two durable cursors, model-seen authority** (re-derived from daemon source;
  `cursorAuthority: "model_seen_only"` is Raft's own literal). Per (session, target):
  `delivered` (inbox/transport state; muted targets never advance it) and `seen` (sole
  authority for freshness holds and catch-up). `seen` advances only on proof: prompt-embedded
  envelopes → turn settle; CLI pull outputs → when the tool result is committed back into the
  session stream (we observe this directly — stricter than Raft's show-and-hope, which papers
  the gap with the `recurring-recovery` recipe). Raft's "read" cursor is a disposable local
  continuation hint (a tmpdir JSON), not schema — ours is in-memory turn state. Notices and
  wakes advance nothing, ever (their wake proofs stamp `cursorImpact: {deliveryAck: false,
  modelSeen: false, read: false}` — adopted as a contract test). A turn that pulled and died
  leaves `read > seen` in effect; catch-up re-delivers from `seen`.
- **I4 — Inbox visibility read-only; attention is agent-owned.** The agent detail panel gains a
  read-only inbox card (pending targets with counts, muted channels, followed threads;
  dev-mode: per-target cursors). No human-side mute/unfollow controls for agents — humans steer
  attention by asking in chat and own membership via existing channel management, Raft-pure.

## 1. System prompt: Raft as template

Adopt Raft's prompt structure and language near-verbatim, renamed to Grotto. New sources stay in
the current files; the contract test gets a new `REQUIREMENTS` set + fresh snapshots reviewed as
one deliberate diff; `bun run eval:prompt` runs against a dev stack after the swap.

### Raft sections taken (verbatim modulo naming)

Identity + `## Who you are`; `## Current Runtime Context`; `## Communication — CLI ONLY`
(grotto command families); `### Credential hygiene` (minus profile-resolution paragraph, until
external agents); CRITICAL RULES; `## Startup sequence`; `## Messaging` header contract;
`### Sending messages` + draft flow (`GROTTOMSG` delimiter); `### Reminders`; `### Threads`;
`### Discovering people and channels`; `### Channel awareness`; `### Reading history`;
`### Historical references`; `### Tasks` + splitting (reconciled to D8); `## @Mentions`;
`## Communication style` + etiquette; Formatting sections; `## Workspace & Memory` + MEMORY.md +
compaction safety (now our entire memory story per D3, plus the natural-boundaries re-read
line); `## Capabilities`; `## Message Notifications`; `## Initial role`.

### Raft sections not taken

| Section | Why |
| --- | --- |
| Profile credential resolution ladder | No per-agent credential profiles until external agents (WS6 era). |
| `### Third-party integrations` (Agent Login) | Plugins are Runtime-owned; revisit post-WS6. |
| `### Third-party app message safety` | No inbound third-party app events yet; adopt verbatim the day they exist. |
| Action cards | Predicated on Member-role agents + multi-human roles; deferred to WS6 era, not rejected. |
| `## Manual` | Deferred (tier 3); seeded notes + skills cover it. |
| PowerShell variant, `slock` aliasing, `## Runtime Profile Control` | N/A. |

### Grotto sections added on top

SOUL / personality; Outputs & Visuals & Widgets (fences ride send bodies; `grotto://` links;
declarative artifacts); a short Skills paragraph (`grotto skill …`); per-plugin CLI mentions;
model-family operational sections (unchanged mechanism); web-access lines.

### What dies

`NO_REPLY`; implicit final-reply delivery; outcome notes; the pushed `Your chats:` block; the
`## USER`/`## MEMORY`/`## Notes` injected sections; `## Memory` (Wiki) section; `## Automations`
section; `## Chat History` tool teaching; all prompt-taught tool catalogs.

## 2. Per-turn context (end-state)

| Surface | End-state |
| --- | --- |
| First session turn | `Start.` (+ one fresh-session line after resets) |
| Trigger delivery | `New message received:` + envelopes + Raft's two-line trailer; unseen rows of the triggering chat ride along as additional envelopes |
| Envelope | `[target=… msg=… time=… type=…] @sender — <description>: …` (+ `[task #N status=… assignee=…]`, attachment suffix) |
| Mid-turn traffic | Content-free inbox notices, Raft row format (first/latest msg, sender, `· task/thread/dm/mention` tags) |
| Unread elsewhere | Nothing pushed; `grotto inbox check` (notice rows only when they change) |
| Identity/roster/description | Not pushed; `server info` / `channel info` pulls (D6) |
| Current time | Envelope timestamps only; home-timezone rule lives in the prompt |
| Freshness | Attested sends: server-held drafts + bounded catch-up + revise / `--send-draft` / silent / `--anyway` paths |
| Cursors | Two per (session, target): `delivered` + `seen` (model-seen authority, proof-based advancement per I3); notices and wakes advance nothing |

## 3. Grotto agent CLI

Per-agent PATH wrapper injected by grotto-runtime carrying agent identity; talks to the chat
surface (local first, grotto.sh after WS6). One command per shell call; stdin bodies; canonical
text out; teach-at-point-of-use everywhere.

| Family | Verbs | Notes |
| --- | --- | --- |
| message | `check` `send` `read` `search` `resolve` `react` | send = attested, draft semantics; react ships with etiquette help text |
| inbox | `check` | target summaries, no drain; attention hints later |
| server / user | `info` | bounded facts, pagination |
| channel | `info` `members` `join` `leave` `mute` `unmute` (+ admin verbs later) | |
| thread | `unfollow` | WS3 |
| task | `list` `create` `claim` `unclaim` `update` | D8 model; board/priority/labels are app lenses |
| attachment | `upload` `view` | |
| profile | `show` `update` | self-edited descriptions |
| reminder | `schedule` `list` `snooze` `update` `cancel` `log` | server-owned schedules; `--script` quiet-tick payload |
| skill | `list` `view` `create` `patch` `write-file` | replaces `skills_*` tools |

Not copied: `agent login`/`bridge` (external agents, WS6 era), `mention pending/notify/add`
(multi-human flows), `manual`, `integration`, `action`.

## 5. UX/UI alignment

Evidence: live recon of app.raft.build ([raft-ux-notes.md](raft-ux-notes.md), captured in the
operator's arcade server 2026-07-21) against our current frontend
([grotto-ui-baseline.md](grotto-ui-baseline.md)).

### Adopted as spec detail (no decision needed; lands in the owning workstream)

- **Composer**: "As Task" checkbox with `⌘⇧↵` send-as-task (WS5); draft pencil indicator on the
  sidebar row while text is unsent; attach buttons unchanged.
- **Message hover cluster**: Reply in thread / Add Reaction / Save Message; right-click menu
  with 6-emoji quick-react strip, Copy Link, Copy Markdown, Open Thread, Unfollow Thread,
  Convert to Task (WS3/WS5).
- **Reply-count pill** on anchors with inline unread qualifier ("2 replies · 1 new") (WS3).
- **Task chip** on origin message: status-colored icon + `#N @assignee`; clicking the chip opens
  the 5-status dropdown inline; creation receipts differ by path ("1 new task created: …" vs
  "[Actor] converted a message to task #N …") (WS5).
- **Task board/list toggle**: 5 status columns/groups (status-colored pills), Creator/Assignee/
  Channel filter popovers with "me"-shortcuts, task title = origin message body verbatim (WS5).
- **Presence signals** (WS2/I1, confirms our split): conditional bottom-of-rail activity strip
  (renders only mid-turn: avatar + dot + live state text "Starting… / Message received /
  Claiming tasks… / Editing file…"), the same state text in the DM/channel header, dot color
  green→amber during work. Notably Raft shows **no in-chat typing bubble at all** — our
  composition stream is a deliberate enhancement beyond observed parity.
- **Attention affordances**: per-channel mute bell in the header; "Stop all agents in this
  channel" header button; pinned section as a drag target; Saved bookmarks view (WS4/WS5).
- **Activity inbox**: All / Unread / Mentions segmented filter; "Channels, DMs, and followed
  threads stay here until they are done" model (WS4).
- **Search**: full-page view, From/Scope/Time/sort filters, thread-grouped results with hit
  counts and highlighted snippets (post-WS4 polish).
- **System receipts**: quiet centered muted lines with timestamp + icon (task creation,
  conversions); date dividers standard.
- Copy-bug to avoid: Raft reuses "SELECT A CHANNEL" placeholder on non-channel list+detail
  pages.

### UX decisions (walked and resolved 2026-07-21 unless noted)

- **U1 — Shell reorganization** (confirmed): rail becomes Search, Chat, Activity (inbox),
  Tasks (global), **Reminders** (global cross-agent index of scheduled work per D4, script
  watchdogs included), **Members** (humans + agents directory — the agent panel's home),
  Settings; Computers joins post-WS6 (runtime page stays in Settings until then). Wiki rail tab
  retires with D3b; the automations tab is renamed and re-pointed, not dropped.
- **U2 — Agent panel**: replace the drawer/settings split with Raft's list+detail Members page
  and 6-tab agent profile: **Profile** (identity, description, role, computer link, runtime
  config pills, env vars, created-agents, skills), **Activity** (raw timestamped diagnostics
  log incl. shell commands, file edits, task transitions, errors; "Copy Diagnostic Info"),
  **Chat** (channels + agent-to-agent DM activity), **Reminders** (read-only; "just tell your
  agent"), **Workspace** (real file tree + Raw/Preview viewer), **Apps** (per-agent
  connections). Confirmed, with: per-agent settings (model, env, web access, session reset)
  fold INTO the Profile tab as editable fields; and from chat the profile renders in the **side
  pane** (same right-pane system as threads/artifacts, one-at-a-time, resizable) — never a
  drawer. The Members rail page is the full list+detail home of the same 6-tab component;
  clicking an agent name anywhere opens it. Persistent header actions: Message / Stop /
  Restart.
- **U3 — Per-conversation tabs** (confirmed): every channel AND DM gets Chat | Tasks | Files
  tabs. Composition principle: there is ONE task query surface and ONE board/list component
  family — the global rail view is the unscoped instance; a conversation's Tasks tab is the
  same component with the conversation filter pinned. No parallel APIs/hooks/UI.
- **U4 — DM tasks in aggregates** (confirmed, resolved by U3's composition principle): the
  global view is the unfiltered query, so DM-anchored tasks appear automatically — Raft's
  silent exclusion (verified live) is impossible by construction. Post-WS6, per-viewer
  visibility scoping trims the same query.
- **U5 — Thread presentation** (confirmed): threads open in a right side pane — which
  desktop-width re-verification showed is Raft's actual design too (the recon's
  "replaces-the-pane" observation was an 800px responsive fallback; see the corrections
  section of raft-ux-notes.md). So T3 is parity, not divergence. Adopt with it: the anchor
  message highlights in the channel while its thread pane is open; "View in channel"
  jump-with-highlight; and Raft's responsive model — at narrow widths the pane collapses to a
  full-pane takeover with a back-chevron. Detail also confirmed at width: avatar-click opens
  the agent profile pane, name-click inserts an @mention (adopted).

## Existing specs impacted

Rewritten or retired by this program (each within the workstream that lands the change; until
then they describe the pre-Raft system): `specs/tasks.md` (superseded by D8), `specs/cron.md`
(D4), `specs/memories.md` + memory specs (D3), Wiki specs (D3b), `specs/steering.md` (I2 —
notices replace body pushes), `specs/sessions.md` (I1/I3 — floating turns, two-cursor ledger;
global-session core survives), `specs/runtime-cli.md` (WS1 — gains the agent surface),
`specs/tavern-skill.md` (D5 — CLI replaces the HTTP-skill approach), ADR 0011 (amended by I1),
prompt contract + snapshots (WS2). New ADRs accompany each landing per `docs/adr/` convention.

## 4. Workstreams

Every issue inherits the program principles (no migration code; manual cutover checklist;
operator approval on destructive steps).

**Sequencing.** Everything before WS2 is additive; WS2 is the flip (CLI-only, zero tools,
floating turns) after which the old reply/tool path is gone. Three phases:
1. **Additive substrate**, parallel: WS1 (CLI + the shared wire contract: D2 names/handles,
   envelope/target grammar — spec written first, everything consumes it), WS3 (threads), WS9
   (shell reorg + composition-bubble UI shell).
2. **The flip**, one coordinated landing window with a single manual-cutover checklist:
   WS2 + WS4 + WS7 — the new turn model IS the inbox delivery model, and the prompt must stop
   referencing memory/wiki/cron the same day they're deleted.
3. **Post-flip**, parallel: WS5 (tasks/reminders/affordances), WS8 (onboarding + seeded
   knowledge); then WS6 as its own program once the CLI-mediated model is proven locally.

Specs are written just-in-time per workstream, except the WS1 wire-contract spec and the WS2
contract-test REQUIREMENTS plan, which are shared interfaces and get drafted first.

- **WS1 — Agent-facing `grotto` CLI v1.** Wrapper injection, agent-scoped tokens, message
  family + `server info` + draft/attested-send semantics, output/error contract. Wire contract
  = the server API. Shippable while tools still exist.
- **WS2 — System prompt + turn rewrite.** Raft template per §1, turn shapes per §2, unique
  name/handle layer (D2), zero-tool cutover (D5), kill `NO_REPLY`/outcome notes/evaluation
  dispatch, floating turns + per-turn response-row removal (I1), typing-from-in-flight-send
  streaming UX, agent status dot + sidebar activity strip, new contract REQUIREMENTS +
  snapshots + 28k budget, `eval:prompt`. Depends on WS1.
- **WS3 — Threads.** Child-container thread model per T1 (own seq domain, anchor + parent
  pointers, follows per participant), immutability posture per T2, side-panel UI + badges +
  rail rollup per T3, `thread unfollow`, auto-follow semantics, inline-reply retirement.
  Unblocks full target grammar and D8's work surfaces.
- **WS4 — Agent inbox.** Delivery planner + attention rules per I1 (mute/unfollow stores,
  piercing), content-free notice pipeline with tool-boundary flush gating per I2, two-cursor
  ledger per I3 (`delivered`/`seen`, proof-based advancement, wake-advances-nothing contract
  test), `inbox check` + `message check`, read-only inbox card on agent detail per I4; retire
  pushed "Unread elsewhere".
- **WS5 — Tasks + reminders + affordances.** D8 tasks (with board view, priorities, labels),
  D4 reminders (+ script payloads; Automations page → Reminders view), reactions, profile
  self-editing.
- **WS6 — grotto.sh server split.** Move the chat surface to the hosted server + DB (drizzle
  migrations); grotto-runtime becomes the machine attachment (claim/attach, wake delivery,
  lifecycle); Clerk Owner/Admin/Member roles, invites; agent credential minting; later external
  agents, action cards, third-party events. Existing seams: `@tavern/api` chat/admin split,
  `grotto claim`, Clerk member forwarding, `docs/api/auth.md` member model. **Data cutover:
  grotto.sh starts fresh — existing local chat history is trashed, not migrated (decided).**
  Agent memory survives regardless: workspaces live on the computer, not in the chat DB.
- **WS7 — Memory/Wiki/Automations retirement.** Delete extraction/dreaming/core-memory
  injection, Wiki, cron product + `cron_*`/`wiki_*`/memory surfaces (D3/D3b/D4); manual cutover
  seeds existing core memory into agent workspaces. Coordinated cut, likely folded into WS2's
  landing window.
- **WS9 — Shell + agent panel reorganization.** U1 rail taxonomy, U2 Members page + 6-tab agent
  profile (absorbs the agent drawer and per-agent settings), per-conversation Chat|Tasks|Files
  tabs (U3), Activity inbox page (with WS4), Search page. Largely parallel to WS3–WS5; shares
  the same design language pass.
- **WS8 — Onboarding agent + seeded knowledge.** Starter `MEMORY.md` + seed-practice notes at
  agent creation, adapted from the full recipe set in [raft-recipes/](raft-recipes/) (13 seeded
  summaries + 20 query-tier cards; card anatomy — `triggers`, `related`, evidence grades,
  When/Rule/Steps/Failure-modes/Proof — adopted as our card format). The 7 archetype cards
  (kickoff prompts + lane design) power agent-creation proposals. Grotto onboarding agent
  modeled on Cindy (local captures of her playbook/objectives/FAQ are the reference).
