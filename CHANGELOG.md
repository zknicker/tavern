# Changelog

All notable changes to this project will be documented in this file.

## v1.4.46 - 2026-07-13

- Runtime: the Browser tool executes agent-browser's native binary directly so
  browser commands work in the packaged Runtime, and the Homebrew formula now
  installs the bundled agent-browser package.
- Runtime: adds subscription-billed image generation via the codex OAuth
  profile.

## v1.4.45 - 2026-07-13

- Runtime/API/App: adds the built-in Browser Plugin — Runtime supervises a
  visible managed Google Chrome with a durable named profile, guarded
  recovery, and `plugin.browser` health; granted agents drive it through one
  `browser` tool and a managed skill, and settings expose the detected Chrome,
  profile name, health, and Open/Restart actions. Requires this Runtime.
- Runtime/API/App: turns create their message at first visible content and the
  app streams into the turn's post; the chat timeline projects conversation
  units with turn-scoped evidence, contributions keep their start order, and
  live turn state supports concurrent agent runs per chat.
- Runtime/App: expands Tasks with dependencies and scheduling, blocked/review
  statuses, shared colored labels, bulk actions, a calendar view, task
  attachments promoted into a runtime artifacts root, dedicated task work
  chats, and the runtime auto-dispatch loop with claims, recovery, and
  settings controls.
- Runtime: adds agent-to-agent mentions and cross-chat posts via `chats_list`
  and `chat_send`, agent bios with per-session instruction freshness, session
  freshness rotation from the reset point, `NO_REPLY` for channels, and
  home-timezone prompt timestamps.
- Server/App: archived chats are listable, read-only, and restorable.
- App: queued drafts steer a mentioned agent's live run, the chat rests
  against its composer with a per-exchange runway, post edits never move a
  reader who scrolled up, and thinking indicators end exactly with the turn.
- Runtime: guards the composed agent system prompt with a contract suite and
  behavioral evals, self-heals CLI PATH under service environments, resolves
  OpenAI Pi models by canonical provider reference, and refreshes seeded
  skills during startup.

## v1.4.44 - 2026-07-07

- Runtime/App: refreshes the Wiki recall capability during Runtime startup and
  keeps expected capability rows visible while the Runtime is still warming up.
- App: reconciles Runtime event catch-up after reconnect without replaying stale
  live turn progress, while still clearing terminal turn state and invalidating
  chat, session, and worker views.
- Runtime release: preserves the packaged `@tavern/sdk` after staging qmd so
  Homebrew can install the Runtime artifact successfully.

## v1.4.43 - 2026-07-07

- Runtime/API/App: adds Tavern Tasks with Runtime-owned task storage, agent
  task tools, server sync, realtime invalidation, dispatch, and full app list,
  detail, and editor surfaces.
- Runtime/API/App: replaces composer command proxies with agent session routes
  plus the agent drawer for session facts, usage, reset, and archived demo
  sessions.
- Runtime/App: adds per-turn Wiki recall over the packaged qmd semantic
  index, recall capability health, prompt evidence capture, and dev-mode turn
  inspection.
- Runtime: improves turn prompt context with timestamps, chat identity, roster,
  model-family guidance, and per-agent run ids for multi-agent fan-out.
- App: adds the Cmd+K command menu, merges per-agent Skills and Plugins into an
  enabled-first settings page, refreshes Tasks and Automations layout polish,
  and adds the alien agent avatar.
- App/Server: fixes settings catch-all redirects, app-root command menu
  mounting, task realtime registration, skill-save validation, agent DM sync,
  chat composer focus, and code editor line-number alignment.

## v1.4.42 - 2026-07-06

- Runtime/API/App: routes Google OAuth callbacks through the Tavern app server
  so desktop Plugin setup completes reliably against Runtime-owned Google
  settings.
- Runtime/App: returns saved Plugin secret presence to settings forms so stored
  MerchBase credentials remain visible and editable.
- Runtime/App: gates Plugin and Skill enablement on configuration, global
  feature state, and agent availability so settings only expose usable
  capabilities.
- App: clears stale chat turn state after a response completes so completed
  turns do not keep the transcript in a running state.

## v1.4.41 - 2026-07-06

- App: repairs legacy automation cache tables during desktop backend startup so
  existing installs can open after the v1.4.40 scheduler schema change.

## v1.4.40 - 2026-07-06

- Runtime/API/App: replaces rich responses with grant-scoped Tavern Widget
  fences, Widget contracts, durable Widget activity, and app renderers for
  charts, calendars, tables, and MerchBase displays.
- Runtime/API/App: adds the runtime-native automation scheduler with cron job
  storage, execution, delivery targets, agent tools, and refreshed automation
  editor and run history views.
- Runtime/App: adds background Memory and skill-work observability, including
  worker status filters, job timelines, report drawers, and live run feedback.
- Runtime/App: makes disk and Plugin skills writable, visible in the shared
  library, updateable, restorable, and backed by usage telemetry and curator
  workers.
- App: polishes the Skills settings surface, automation editor sizing, agent
  picker behavior, and settings navigation.

## v1.4.39 - 2026-07-06

- Runtime/App: adds the Google Plugin with Tavern-managed OAuth and Google
  Calendar event list, search, and create tools.
- Runtime: packages the Tavern-owned Google OAuth desktop client into Runtime
  release artifacts so Homebrew-installed Runtime builds can connect Google.
- Runtime/App: streams live harness turn activity and simplifies live turn
  narration with calmer replace-in-place updates.
- Runtime/App: adds live Memory job events, Runtime home timezone handling, and
  Wiki root startup repair.
- App: polishes chat toolbar icons, sidebar activity hover behavior, profile
  photo controls, and transcript agent mention appearance.

## v1.4.38 - 2026-07-04

- Runtime/API: adds the Memory stack with shared Wiki tools, core memory
  prompt wiring, model-driven memory workers, worker health, and the
  Memory worker Runtime capabilities.
- Runtime/App: adds rich references for agents, skills, apps, plugins, and
  workspace paths, including skill activation hints and agent-scoped skill
  autocomplete.
- Runtime/App: adds Runtime-backed Tavern channel creation and participant
  editing, including multi-agent channels and explicit agent addressing.
- Runtime/App: reworks streaming turn rendering, tolerates delivered messages
  missing turn metadata, and keeps channel messages human-only until an agent is
  explicitly addressed.
- App: refreshes Agent avatars, global Memory settings, chat/sidebar polish,
  toolbar history navigation, breadcrumbs, participant slots, and message chip
  styling.

## v1.4.37 - 2026-07-02

- Runtime: runs the Codex bridge bootstrap install from the bridge directory in
  non-interactive mode so Codex agent turns can recover cleanly after a failed
  or stale sandbox install.
- Runtime/App: separates assistant commentary from the final assistant reply and
  preserves message phase metadata for chat rendering.
- App: improves active-turn recovery, MerchBase Plugin chat capability
  projection, Agent avatar rendering, and channel hash icon geometry.

## v1.4.36 - 2026-07-02

- Runtime: recovers interrupted Agent turn rows on startup so a stale running
  turn cannot block future Codex replies after restart.

## v1.4.35 - 2026-07-02

- Runtime: pins the packaged Codex bridge to Codex 0.142.5 so installed
  Runtime turns do not hang on the older vendored Codex binary.
- Runtime: fails stalled Agent turns after a configurable watchdog timeout
  instead of leaving chat responses running forever.

## v1.4.34 - 2026-07-02

- Runtime: stages Codex and Claude Code harness bridge assets in packaged
  Runtime artifacts so agent execution can bootstrap reliably after install.
- App: keeps the chat rail visible on new-tab chat surfaces.

## v1.4.33 - 2026-07-02

- Runtime: added executable model provider management with curated provider
  lifecycle state.
- Runtime: ensured built-in Agent DMs exist and bounded harness chat context.
- Runtime: hardened the MerchBase Plugin boundary.
- App: added Agent character avatars across chat and settings, including
  theme-aware artwork and a character picker.
- App: moved active chat status above the composer, restored collapsed-sidebar
  click handling, defaulted layout to the topbar, and polished Runtime settings.
- Docs: documented model provider lifecycle and Agent character authoring.

## v1.4.32 - 2026-07-01

- Rebuilt Tavern around chat-native Agent seats, Agent sessions, and Agent
  turns.
- Moved Claude Code and Codex execution to AI SDK HarnessAgent.
- Kept OpenAI/API-key and deterministic e2e execution on AI SDK LanguageModel
  routes.
- Made Runtime the source of truth for model catalog, Agent default model,
  session effective model, tool inventory, and sandbox mode.
- Switched model catalog behavior to curated provider lists with explicit
  availability state.
- Removed retired engine compatibility paths, interactive tool approval prompts,
  old settings pages, and stale docs.
