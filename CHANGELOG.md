# Changelog

All notable changes to this project will be documented in this file.

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
  Semantic Memory root startup repair.
- App: polishes chat toolbar icons, sidebar activity hover behavior, profile
  photo controls, and transcript agent mention appearance.

## v1.4.38 - 2026-07-04

- Runtime/API: adds the Memory stack with shared Memory tools, core memory
  prompt wiring, model-driven memory workers, worker health, and the
  `memoryWorkers` Runtime capability.
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
