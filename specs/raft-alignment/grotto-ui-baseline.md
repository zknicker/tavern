# Grotto frontend UI anatomy (as of 2026-07-21, pre-Raft-alignment)

Paths relative to apps/website/. Source: Explore agent sweep.

## 1. Rail/sidebar
Two-column shell: 48px icon rail (`features/shell/app-icon-rail.tsx` — Home, then tool tabs
['tasks','automations','wiki'] capability-gated, Settings pinned bottom) + panel
(`features/shell/sidebar.tsx`: SidebarHomeNav ["Activity" → /overview] + AppSidebarChatList;
settings routes swap to SettingsSidebarNav; footer update+auth items; no collapse).
`sidebar-chat-list.tsx` (530 lines): sections Channels (hover "+ New channel"), Direct messages,
Task chats (only if non-empty), Archived (link). Row = icon (hash box / AgentFace) + title
(bold if unread) + indicator. Unread taxonomy: channels quiet numeric count, DMs strong
bg-primary pill capped 99+ (deliberate: "ordinary agent chatter never out-inks the selected
row"). `SidebarAgentPresenceDot`: green idle / amber busy dot on DM AgentFace — only presence
in rail. Context menu: rename/color/participants/system-prompt/archive. Grouping:
`sidebar-chat-list-model.ts`. NO agent roster section — agents surface only via DM rows.

## 2. Chat view
Topbar `chat-room-topbar.tsx`: room icon + title (channels get ChannelNameMenu dropdown:
edit/archive; DMs static h1), AgentPresenceBadge (dot + "Replying…"/"Working in X…", DMs only),
Archived badge, channel description inline clickable (opens ChannelEditDialog), right: dev menu,
ChatParticipantsControl (people-count chip, no facepile), ChatPaneToggleButton. (An unused
chat-participant-facepile.tsx exists.)
Transcript: `chat-detail-frame.tsx` scroller; `chat-transcript-turn.tsx` (964 lines) —
Slack-style left-aligned rows for everyone (no self bubbles): 40px TurnAvatar (agents = bare
AgentFace; humans = image/initials) + MessageHeader (name, bio ≤165ch, timestamp, hover
actions) + content. Agent avatar wrapped in AgentHoverCard → click opens AgentDrawer.
NO reply-to-parent/threading UI anywhere (confirmed). Streaming: AssistantReplyBody/Text with
useRevealedText + useStreamingTextRanges + ratcheted min-height; narration replace-in-place
slot, drops when final reply lands (full narration only in ChatTurnDrawer via "View turn
details"). Activity: AgentTurnSegment → ChatTranscriptActivityGroup → working-log.tsx
(collapsible, "Working for Xs" ticker or work-group label+icon) → ActivityStep →
ToolStep/WorkerStep/SystemStep(thinking); tool-steps/ dir with intent catalog/resolver copy.
Markdown: chat-transcript-message.tsx + chat-markdown-text.tsx; mention chips.
Composer `chat-message-composer.tsx`: PromptInput, useMentionComposer (MentionKind = agent |
app | directory | file | image | plugin | skill), attachments + drag/drop overlay,
AgentBusyElsewhereHint ("X is busy in Y — your message is queued"), ChatComposerContextFullness
meter.

## 3. Agent surfaces (split, not cross-linked)
In-chat read-only: AgentHoverCard → AgentDrawer (`features/chats/agent-drawer.tsx`): identity
header, Session card (model, context meter, turn count, status, started/last-activity), stale
system-prompt warning, Recent activity (turn-grained), Past sessions table. Explicitly no
settings ("Session resets live in agent settings, not here"); NO link to settings page. GAP.
Settings: /settings/agents/:agentId/{general|skills|channels} (app-router.tsx:373-409, nav in
settings/layout/navigation.ts:100-124). General: appearance, model, env vars, SOUL.md inline
editor (AgentWorkspaceFileEditor), tasks-dispatch, web access, session reset, delete. Skills &
Plugins tab: granted lists (ability-rows.tsx). Channels tab reuses settings/channels/page.tsx.
No per-agent Memory tab — agents/:agentId/memory redirects to global /settings/memories.
Global Grotto Runtime settings (agent-runtime/): capabilities table, auto-dispatch, timezone.

## 4. Panels
ChatArtifactPanel (`chat-artifact-panel.tsx`): chat-scoped right pane, framer-motion width
tween, ResizablePaneRail persisted width, toggled from topbar or linked-resource clicks
(ArtifactPanelOpenProvider). Chrome (`chat-artifact-panel-chrome.tsx`): scrollable closeable
tabs, + source menu, per-tab options (open source/copy link/copy path), hide ×. Target kinds
(tavern-resource-link.ts): wikiPage, wikiDirectory, workspaceFile only; workspace file+tree
share one morphing tab. Other right drawers: AgentDrawer, ChatTurnDrawer, CronRunsDrawer.

## 5. Activity/evidence/reads
Work evidence per §2 (working-log). Agent activity feed: agent-activity-labels.ts +
useAgentActivity → hover card (5-entry preview) + drawer (full): replied/failed/declined/
stopped/new_session with colored dots + relative time. Read receipts: NONE (no per-participant
seen UI); only single-viewer unread reset via use-chat-mark-read.ts (chat.markRead mutation,
optimistic sidebar pill zero). Presence: dots in rail/topbar/hover card + composer busy hint.

## 6. Automations page (cron) — ~35 files, mature
/automations + /automations/new|edit/:jobId. CronView: sidebar filter/selection (by status or
agent), search, counts (active/paused/failures/total), job list with per-row status + actions
(run now/toggle/edit/delete), CronRunsDrawer + run-detail drawers. Suggested automations
templates + home-brief template. Editor: left prompt pane; right sidebar sections Status
(enabled switch, next/last run), Schedule fields, Delivery (agent picker, run type agentTurn |
script | systemEvent, delivery-chat fields), History (edit mode). cron-availability-gate.

## 7. Tasks — exists, NOT a kanban board (~20 files)
/tasks, /tasks/new, /tasks/:taskId. TasksView: left views mini-sidebar (All/Active/Backlog/
My tasks/Epics/Calendar) + content. tasks-list.tsx groups by status as vertical sections
(FluidList of TaskRow: checkbox select, labels, priority, blocked-reason badge, activity
indicator, assignee AgentOptionLabel, attachments/deps icons, relative time). Calendar view.
Bulk actions, multi-select, label mgmt (picker + manage dialog + colors), dispatch queue
indicator, dependencies, attachments, detail/new editor panes. NOTE: frontend tasks impl is
substantial even though specs/tasks.md auto-dispatch was "impl not started" — raw material for
D8 lenses.

## 8. Navigation
app-router.tsx; AppFrame → RuntimeSetupGate → MembershipGate → Layout. Routes: /overview
(home/activity feed), /chats/:chatId, /chats/archived, /tasks*, /automations*, /wiki (top-level
rail tab!), /models (legacy), /design/brief (dev). Many retired routes redirect (workspace,
skills, workers, events, logs, pulse, memories, jobs, stats, agent). Settings sections:
General (Runtime, Appearance, Profile, Members, Updates, Models, Memories, Skills, Plugins),
Activity (Sessions, Jobs, Stats), per-agent (General, Skills & Plugins, Channels). Wiki
promoted to rail; Memory buried in Settings.
Dead code: features/chats/chats.tsx + chats-list.tsx orphaned from pre-rail shell.

## Gap flags vs decided Raft-alignment direction
- No threads anywhere (T1-T3 greenfield in UI too).
- No read receipts / per-participant seen (I-decisions make reads explicit via pulls).
- Agent drawer ↔ agent settings unlinked; Raft-style unified tabbed agent panel absent (Zach
  wants Raft's tabbed organization).
- Streaming = response-row reveal (dies per I1; composition stream replaces).
- Work groups render in-transcript (retire to agent panel per I1).
- Tasks list/calendar exists but no board; task chips in chat absent (D8).
- Wiki rail tab + /settings/memories + automations pages retire (D3b/D3/D4); automations page
  becomes Reminders view.
- Sidebar has no agent activity strip (bottom-of-sidebar, Raft-style, decided in I1).
