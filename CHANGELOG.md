# Changelog

All notable changes to this project will be documented in this file.

## v1.4.22 - 2026-06-19

Runtime floor raised to 1.4.22 for saved agent environment values and new
Widget tool contracts.

App changes:

- Replaced Vault's source Markdown editor with an MDXEditor-backed rich
  Markdown editor, Tavern-styled toolbar, app-level edit/split/preview controls,
  file breadcrumb, and a cleaner Metadata sidebar.
- Added composed chart rendering and calendar day Widget rendering in chat.
- Shows saved agent environment values in Settings, prefetches model settings,
  prevents skill row text selection, and adds the missing Appearance settings
  row divider.
- Removed the obsolete participant profile settings surface.

Runtime changes:

- Added composed chart and calendar day Widget tools, validation, activity
  projection, and demo coverage.
- Returns saved agent environment values to the app settings API.
- Improved agent Widget render guidance and removed the unused highlights job.

## v1.4.21 - 2026-06-19

App-only release. The Runtime floor stays at 1.4.20.

App changes:

- Stabilized chat reply handoff geometry so live assistant replies do not snap
  when their durable message row takes over.
- Anchored chat tail correction immediately after smooth follow-to-tail scrolls
  settle.
- Summarized collapsed tool drawer headers by tool intent, with stable active
  copy for mixed file, search, command, Widget, and approval work.

## v1.4.20 - 2026-06-19

Runtime floor raised to 1.4.20 for the widget activity schema repair.

App changes:

- Requires Runtime 1.4.20 so upgraded apps do not keep using a Runtime that
  rejects widget activity rows.

Runtime changes:

- Repairs legacy Runtime chat activity tables so Widget tool completions can
  persist `widget` activity rows after upgrading from pre-widget databases.

## v1.4.19 - 2026-06-18

Runtime floor raised to 1.4.19 for writable Vault APIs, managed Vault runtime
assets, chat widget contracts, and streamed reply/file attachment correctness.

App changes:

- Rebuilt Vault as a compact wiki browser and Markdown editor with a dense file
  tree, create/delete/rename actions, folder moves, search, full-width edit and
  preview modes, and a collapsible Metadata sidebar.
- Added first-class chat widgets for charts and calendar events, with polished
  animated chart rendering and standardized widget input.
- Improved chat streaming, inline Markdown links, long-token wrapping,
  attachment focus, approval dismissal, external desktop links, sidebar chrome,
  settings layout, and global context-menu styling.

Runtime changes:

- Added writable Vault Runtime and server APIs for page and folder creation,
  deletion, movement, and persisted Markdown edits.
- Replaced the Cortex wiki surface with managed Vault skills, capabilities, CLI
  commands, runtime assets, and documentation.
- Added widget activity contracts for chart and calendar rendering.
- Preserved model provider and streamed reply formatting through Hermes events,
  materialized file attachments before prompt submit, protected managed skills,
  and tracked managed Hermes live patches.

## v1.4.18 - 2026-06-17

Runtime floor raised to 1.4.18 for configured managed agent settings.

App changes:

- Smoothed chat reply streaming and virtualized autoscroll so long agent
  replies reveal steadily, final message formatting does not replay, and
  presence rows stay pinned above the composer.
- Restored chat approval footer actions and stop controls.
- Improved app chrome drag regions across the window.

Runtime changes:

- Preserved configured managed agent settings across Runtime startup and
  adapter refreshes.

## v1.4.17 - 2026-06-16

App-only release. The Runtime floor stays at 1.4.16.

- Polished Automations with a card-less list, shared pill tabs, breadcrumb
  editor navigation, always-visible row actions, and status dots for active,
  paused, and failed schedules.
- Fixed cron list and run reads so Runtime refreshes no longer emit repeated
  invalidation updates that can spam `cron.list` requests.
- Surfaced cron run failures in the automation list and run history without
  fading paused rows.
- Tightened dashboard chrome interactions including pinned chat colors, approval
  tool rows, live thinking status, tool drawer animation, archived-chat drafts,
  and Runtime version mismatch messaging.

## v1.4.16 - 2026-06-16

Runtime floor raised to 1.4.16 for managed Hermes workspace context.

App changes:

- Stabilized chat presence motion, virtualized scroll restoration, and composer
  draft preservation across chat navigation.
- Added missing model provider icons and polished sidebar chat actions,
  settings controls, and Appearance copy.

Runtime changes:

- Passed the managed workspace to Hermes chat sessions and Tavern-created cron
  jobs so generated `AGENTS.md` instructions, Tavern skills, Cortex wiki skills,
  and visible-progress guidance are injected into agent work.
- Improved Cortex wiki topic-planning guidance for ingestion, compilation,
  linting, and librarian runs.

## v1.4.15 - 2026-06-15

Runtime floor raised to 1.4.15 for stopped-turn recovery, steered chat message
projection, managed Cortex wiki skill naming, and model command completion.

App changes:

- Stabilized virtualized chat autoscroll so live replies and agent presence
  rows stay anchored without extra scrollable bottom space.
- Rendered steered queued messages inline and kept queued follow-up sends
  available during new-chat handoff.
- Show stopped turns immediately as muted chat rows instead of leaving active
  reply state hanging.
- Polished model command completion, mention parsing, and shared dialog, select,
  and scroll-area interactions.

Runtime changes:

- Added stopped-turn chat rows and sync contracts so cancelled turns recover
  consistently across runtime history and the app timeline.
- Projected steered chat messages through Runtime/server chat APIs so follow-up
  instructions render as first-class timeline entries.
- Renamed the managed wiki skill package to Cortex wiki across Runtime assets,
  capabilities, status, and generated workspace instructions.
- Improved managed Hermes model route completion support used by `/model`.

## v1.4.14 - 2026-06-15

Runtime floor raised to 1.4.14 for managed agent environment settings.

App changes:

- Added Settings -> Agent controls for write-only agent environment variables.

Runtime changes:

- Added a vault-backed `/agent-env` Runtime API and managed Hermes `.env`
  materialization so saved variables are available to the managed agent after
  restart.
- Preserved operator-managed env entries while clearing stale Tavern-managed
  agent env names during generated config writes.

## v1.4.13 - 2026-06-15

Runtime floor raised to 1.4.13 for assistant memory configuration, queued
message steering, and cancelled-turn event contracts.

App changes:

- Added an Appearance setting for the side-navigation app layout, with
  Codex-style hover reveal, settings navigation, direct chat archive controls,
  and polished sidebar drag/overlay behavior.
- Added queued-message steering in the composer so follow-up instructions can
  stack behind an active turn.
- Improved chat presentation for image attachments, active work drawer headers,
  tool rows, working affordances, and transcript spacing.
- Renamed the Cortex wiki surfaces to use Tavern-owned product language across
  the app and docs.

Runtime changes:

- Added managed assistant memory configuration and capability reporting for the
  Runtime-backed memory stack.
- Added Runtime and server contracts for steering queued messages into an active
  chat turn.
- Fixed stopped chat turns to settle as cancelled and emit the cancellation
  events the app needs to clear active work.

## v1.4.12 - 2026-06-14

App-only release. The Runtime floor stays at 1.4.9.

- Improved chat image attachments so inline screenshots render as compact
  thumbnails in the message surface instead of blank file frames.
- Tightened chat transcript spacing between user messages, attachments, and
  assistant replies while keeping hover metadata available.
- Clarified the release docs for when app changes require a Runtime floor bump.

## v1.4.11 - 2026-06-14

Compatible Runtime release. The Runtime floor stays at 1.4.9.

Runtime changes:

- Fixed chat-scoped Hermes session routing so slash commands and normal turns
  share the same live session client and Tavern-owned session binding.
- Fixed `/new`, `/clear`, and `/status` so they reset or inspect the
  Tavern-bound session instead of creating a separate command-runner session.
- Added skill mention projection so explicitly tagged `SKILL.md` instructions
  are injected into the engine prompt for that turn.

## v1.4.10 - 2026-06-13

App-only release. The Runtime floor stays at 1.4.9.

- Added persistent agent presence eyes below chat turns, with live thinking and
  response states.
- Improved chat streaming motion so thinking, reply text, and the presence row
  settle without replaying message entrances or jumping during line wraps.
- Improved chat composer sizing, transcript tail initialization, tool drawer
  hover rows, command palette context-fullness display, and overview welcome
  copy.
- Fixed managed progress updates so live work stays preserved while the
  transcript updates.

## v1.4.9 - 2026-06-12

Runtime floor raised to 1.4.9 for chat clarifications, turn-aligned timeline
pages, command/dismissal contracts, and Runtime-backed skill, toolset, and MCP
catalog flows.

App changes:

- Added chat clarifications, composer commands, command cards, response
  dismissal, and chat clearing in the main chat timeline.
- Changed chat history to load turn-aligned keyset pages so older transcript
  windows stay stable while live turns continue.
- Added split Skills and Toolsets pages with installed/available views, source
  management, skill previews, toolset setup, and MCP catalog/server panels.
- Improved live chat rows, thinking-to-reply height stability, skill list
  styling, and skill dialog sizing.

Runtime changes:

- Added Runtime API, SDK, and OpenAPI contracts for clarifications, chat
  timeline pages, response soft delete, chat clear, agent commands, skill hub,
  toolset setup, and MCP catalog/server access.
- Added Runtime proxies for engine skill install/uninstall, skill taps, available
  skill discovery, Runtime-side tap search, toolset setup, and MCP catalog data.
- Fixed Runtime bearer-token use for settings and connector requests, app-side
  capability refresh on Runtime capability events, mention inventory limits, and
  skill install/uninstall to run through the engine CLI.

## v1.4.8 - 2026-06-12

App-only release. The Runtime floor stays at 1.4.7.

- Fixed chat work drawer headers so live file edits say what is being edited,
  completed tool groups use contextual summaries, and generic tool counts do
  not duplicate.
- Fixed the Tavern updater to show progress while an update is staging.
- Fixed desktop release publishing so only the current release artifacts are
  uploaded.

## v1.4.7 - 2026-06-11

Runtime floor raised to 1.4.7 for the Cortex wiki maintenance, health, todo,
backlink, and follow-up contracts in this release.

- Added Tavern-managed wiki maintenance: default wiki crons, run-on-start job
  recovery, daily todo upkeep, librarian action runs, compile rescoring, inbox
  automation, blocked-todo review, and user-owned follow-ups that can open agent
  chat from highlights.
- Added Cortex health surfaces with structured librarian scan data, history
  trends, and last-resort escalation signals.
- Added navigable Cortex wiki links, backlinks, trust-report browsing, archived
  output hiding, and stronger Markdown/frontmatter/search fidelity.
- Changed the wiki format from inventory-owned records to Tavern-owned todos:
  completed todos are deleted, `log.md` is the durable history, blocked todos
  resolve into the wiki, and Cortex wiki fallback paths are removed.
- Updated managed wiki skill instructions and generated AGENTS.md guidance to
  match the pipeline model and fresh-context agent workflow.
- Fixed Cortex health reads to send the Runtime auth token and chat recovery to
  finalize turns orphaned by a Runtime restart.

## v1.4.6 - 2026-06-11

App changes:

- Added settings for connectors, permissions, subagent defaults, context
  compression, fallback models, timezone, and the editable agent avatar glyph.
- Improved agent settings saves with optimistic updates, coalesced restart
  toasts, one-line settings descriptions, and less control flicker.

Runtime changes:

- Added vault-backed MCP connector config, Runtime permission settings,
  execution settings, the managed Tavern skill, and generated AGENTS.md block
  reconciliation.
- Changed managed Hermes config writes to use domain-owned sections with
  coalesced restarts that defer while turns are active.
- Fixed Homebrew Runtime services so Runtime state stays under
  `~/.tavern/runtime`, matching `tavern token`, app pairing, and the documented
  default root.
- Fixed Runtime startup, auth, and dev paths by seeding environment Runtime
  connections, authenticating Tavern skill API calls, retrying startup
  confirmation until Runtime answers, and passing the `serve` subcommand to the
  dev Runtime entrypoint.
- Improved Runtime pairing errors so missing and invalid bearer tokens are
  distinguishable.

## v1.4.5 - 2026-06-11

- Fixed desktop app startup when the configured Tavern Runtime is unreachable.
  Tavern now opens from local app state, checks Runtime reachability in the
  background, and shows checking/disconnected Runtime status inside the app
  shell.

## v1.4.4 - 2026-06-11

Runtime auth and pairing release. The Runtime floor is raised to 1.4.4 for the
new bearer-token contract across Runtime HTTP, websocket, app sync, CLI, and
agent execution paths.

- Added required bearer-token auth to Runtime HTTP and websocket endpoints.
- Added `tavern token` and app pairing fields so users can copy the Runtime
  token into onboarding and Runtime settings.
- Changed Runtime host configuration to use `tavern.json`, shared by the dev
  stack, Runtime CLI, and local probes.
- Fixed token propagation across chat sync, SDK clients, e2e helpers, managed
  agent environment, and dev-stack health checks.
- Improved chat history reads by pushing event visibility, limits, and
  single-chat lookups into SQL.
- Removed the dead Docker web-stack deploy path and unused legacy packages.

## v1.4.3 - 2026-06-10

Runtime CLI and managed engine release. No app behavior changes; the Runtime
floor stays at 1.4.2.

- Added a revamped `tavern` CLI: banner with a live runtime status line on bare
  `tavern`, registry-generated help with per-command and group help, did-you-mean
  suggestions, and a 0/1/2 exit-code contract.
- Added `tavern status`: one-screen host health with service state, running vs
  installed version (including the staged-restart case), capability health with
  reasons, and engine resolution; supports `--json` and `--runtime-url`.
- Changed `tavern update` to report the true end state — it compares the staged
  binary against the running Runtime and says when a restart is still required,
  with `--restart` or a TTY prompt to cut over. `tavern restart` now waits for
  Runtime health and confirms the new running version.
- Changed cortex and engine commands to aligned output, per-subcommand
  validation and help, and friendly unreachable-runtime errors.
- Fixed the managed engine install stranding its Python interpreter when the
  installer sandbox was cleaned up; interpreters now persist under the engine
  pin, broken installs are detected and reinstalled, and agent memory setup
  bootstraps pip in uv-created venvs.
- Fixed the bundled Mnemosyne wheelhouse to target the pinned engine interpreter
  (cp311 on macOS arm64) so agent memory installs offline on fresh hosts.

## v1.4.2 - 2026-06-10

- Added live work rows for engine notices, background workers, and tool approval requests in chat.
- Fixed thinking and tool-only phases so delivered replies stay visible and live turn rows keep stable identities.
- Improved work drawer motion, turn header stability, and chat scroll behavior during active turns.
- Hardened approval response handling across Runtime and app chat APIs.
- Raised the required Runtime floor to 1.4.2 for the approval, worker, and live activity contracts in this release.

## v1.4.1 - 2026-06-10

- Added managed engine bootstrap and production pin guarantees so Tavern Runtime acquires the bundled engine instead of relying on a host install.
- Improved chat streaming, scroll anchoring, tool rows, tool drawers, focus rings, and Cortex Markdown browsing.
- Fixed Hermes Gateway turn handling, progress event mapping, tool row focus/hover states, and sticky inspect controls.
- Raised the required Runtime floor to 1.4.1 for the managed engine bootstrap, Gateway, and capability behavior in this release.

## v1.4.0 - 2026-06-09

- Replaced the OpenClaw/Cortex stack with managed Hermes execution, the Cortex wiki hub browser, and managed Hermes wiki skill.
- Added Hermes-backed model provider settings, runtime skills and toolsets, cron delivery and run history, Tavern channel context tools, and editable managed agent workspace files.
- Fixed managed agent model saves so Tavern no longer infers or persists a Codex runtime path from `openai-codex`; Hermes keeps its default runtime unless Hermes config explicitly opts into Codex app-server runtime.
- Raised the required Runtime floor to 1.4.0 for the Hermes Gateway, model config, runtime skill, cron, workspace file, and Cortex wiki contracts.

## v1.3.0 - 2026-06-09

- Replaced the GBrain/PGlite Cortex stack with a read-only Cortex wiki hub browser and managed Hermes wiki skill.
- Updated Runtime packaging, Homebrew assets, capability checks, and docs for the Cortex wiki hub.
- Raised the required Runtime floor to 1.3.0 for the new Cortex API, wiki hub, and managed Hermes integration.

## v1.2.9 - 2026-06-06

- Fixed Tavern Runtime startup from Homebrew installs by installing the PGlite assets required by Cortex.
- Raised the required Runtime floor to 1.2.9 so the app stages the fixed Runtime package.

## v1.2.8 - 2026-06-06

- Fixed desktop backend startup when the configured Tavern Runtime is temporarily unavailable while model access jobs initialize.

## v1.2.7 - 2026-06-06

- Added the GBrain-aligned Cortex stack with PGlite storage, Cortex CLI commands, Hermes Cortex skills, source ingestion, imports, recall, embeddings, schema additions, page history, and revert.
- Added Cortex background jobs for chat ingestion, Dream reports, embedding generation, and index repair, with health surfaced through Runtime capabilities and Memories settings.
- Added Tavern Vault-backed model access for Codex, OpenAI API, and OpenRouter, including configurable Cortex models for embedding, query expansion, Dream, chat ingestion, OCR, and transcription.
- Updated Cortex docs, API contracts, Runtime release packaging, and smoke tests for the new Runtime-owned Cortex architecture.
- Raised the required Runtime floor to 1.2.7 for the new Cortex API, storage, job, CLI, and plugin contracts.

## v1.2.6 - 2026-06-03

- Added sharper Tavern overview copy on the home screen.
- Fixed composer newlines so Command-Enter inserts a line break instead of submitting the draft.
- Fixed chat transcript focus and return-scroll behavior so recent messages stay in view without stealing focus.
- Fixed Runtime capability refresh after Cortex embedding settings changes.
- Fixed managed Hermes startup so Tavern disables the GPT-5 personality overlay.

## v1.2.5 - 2026-06-03

- Fixed signed desktop releases failing to start after the edit context menu sidecar was omitted from the Electron app bundle.
- Fixed Runtime-only updates so they restart Tavern Runtime without invoking the desktop app updater.
- Refined desktop updater tooltip and toast copy.

## v1.2.4 - 2026-06-03

- Added narrow Runtime-backed settings mutations for agent name, model, thinking default, and Discord bindings, and raised the required Runtime floor to 1.2.4.
- Changed settings saves to use field-level autosave with saving/error toasts, while keeping agent instructions on explicit save.
- Removed the app-managed Hermes config draft and global Settings save bar.
- Added Tavern homepage highlights.
- Fixed desktop edit context menu behavior, chat select-all scoping, and update check result display.

## v1.2.3 - 2026-06-03

- Added a unified desktop updater flow that stages required Runtime updates, downloads the app update, and waits for one user restart before cutting over.
- Changed Runtime updates so `tavern update` stages the Homebrew package without restarting the running Runtime, while the app performs the Runtime restart only during final update restart.
- Added Runtime update status and restart control APIs, and raised the required Runtime floor to 1.2.3 for this app release.
- Fixed Hermes-backed send and cron controls so they gate on Runtime capability health and update when capability events arrive.
- Fixed development stack shutdown so child process groups are cleaned up more reliably.
- Polished chat prompt input composition, setup-state rendering, desktop update UI, and app corner styling.

## v1.2.1 - 2026-06-02

- Fixed macOS traffic light alignment in the Electron desktop shell.
- Polished topbar tabs with smoother active/hover states, quieter secondary-button greys, and clearer pinned chat color markers.

## v1.2.0 - 2026-06-01

- Migrated the desktop app from Tauri to Electron while preserving the macOS window treatment, transparent background, and traffic light placement.
- Reset the Electron desktop release line to 1.2.0.
- Updated Electron dev startup so `bun run dev` starts the managed Runtime stack, launches the app against Vite, and cleans up stale Tauri sidecars.
- Replaced Tauri release artifacts with Electron signing, notarization, updater metadata, and S3 publishing.

## v1.1.16 - 2026-06-01

- Added Settings -> Instructions for editing the managed agent's custom AGENTS.md block with a code editor and a generated AGENTS.md preview.
- Added Runtime API and realtime updates for reading the current generated managed workspace instructions.
- Simplified agent appearance settings, removed the Runtime JSON drawer, and replaced the agent avatar package with the app's built-in avatar UI.
- Fixed agent model settings so explicit non-preferred Hermes harness routes are preserved when reading and saving settings.

## v1.1.15 - 2026-06-01

- Fixed Tavern Runtime URL saves so unreachable URLs still persist in the app database and reopen with the configured URL.
- Fixed the desktop update indicator on onboarding so app updates are visible even when Runtime is disconnected or unreachable.

## v1.1.14 - 2026-06-01

- Added native Runtime notice rows for Hermes session and compaction notices, with an inspect drawer and regression coverage for both final delivery paths.
- Fixed Hermes verbose runtime notices leaking into assistant replies.
- Fixed managed Hermes plugin changes in the dev stack so plugin rebuilds are synced into the managed runtime.
- Fixed chat transcript scroll initialization in general chat.
- Added last-activity times to the temporary chat menu and sorted those chats by creation time.
- Refined dashboard shell tab styling.

## v1.1.13 - 2026-05-31

- Simplified Runtime model inventory to match Hermes's model catalog shape and removed unused model policy writes.
- Fixed model capability health so synced Hermes models report correctly and stale model snapshots self-heal.
- Reorganized Runtime capability sections and moved app/runtime versions into quieter metadata.
- Fixed desktop dev startup by building the macOS app icon asset before launching Tauri.

## v1.1.12 - 2026-05-31

- Decoupled app releases from Runtime releases with a minimum compatible Runtime version, so app-only patch updates no longer force a Runtime update.
- Updated release tooling and docs so agents choose app-only, compatible Runtime, or required Runtime release lanes and publish Runtime artifacts only when requested.

## v1.1.11 - 2026-05-30

- Fixed chat sends so stale app-local Runtime errors no longer block a configured Runtime; sends now gate on the Runtime `gateway` capability.

## v1.1.10 - 2026-05-30

- Fixed desktop releases rebuilding with stale embedded server versions after app version bumps.

## v1.1.9 - 2026-05-30

- Added the desktop updater action to the onboarding app-update screen when Runtime is newer than the app.

## v1.1.8 - 2026-05-30

- Fixed Runtime skill inventory so missing Codex CLI support is handled through capability health instead of crashing Runtime.
- Updated the Homebrew Runtime service environment so managed Hermes and Codex commands can find Homebrew-installed binaries.

## v1.1.7 - 2026-05-30

- Fixed unreachable Runtime onboarding so it keeps the saved Runtime URL, shows the connection error, and does not report a version mismatch without a Runtime version.

## v1.1.6 - 2026-05-30

- Fixed disconnected Runtime onboarding showing stale Runtime update copy and the old saved URL.

## v1.1.5 - 2026-05-30

- Fixed stale or unreachable Runtime connections showing the Runtime update screen instead of the connect form after disconnect.

## v1.1.4 - 2026-05-30

- Added exact app/Runtime version checks with an onboarding update flow, Runtime update progress, timeout handling, and disconnect recovery.
- Added `tavern update` and `tavern restart`, kept `tavern-runtime` as a compatibility binary, and documented Homebrew install/update/env usage.
- Changed the default Runtime port to `18790`.
- Refreshed the Tavern brand color to a dustier purple.

## v1.1.3 - 2026-05-30

- Show onboarding when Tavern Runtime is unavailable instead of leaving the app stuck retrying the dashboard connection.
- Added a global desktop update hint that downloads updates in the background and keeps a restart action visible when an update is ready.

## v1.1.2 - 2026-05-30

- Fixed the macOS app and DMG icons by compiling the Icon Composer source into the bundled Liquid Glass asset catalog with an ICNS fallback.

## v1.1.1 - 2026-05-30

- Added a standalone `tavern-runtime` release artifact for always-on Mac mini deployments.
- Added Homebrew tap publishing so releases can update `zknicker/homebrew-tavern` with the runtime formula.
- Added Runtime deployment docs for Homebrew services, trusted-network exposure, and app Runtime URL setup.
- Patched the transitive `qs` dependency to clear the current dependency audit.

## v1.1.0 - 2026-05-30

- Added Cortex-backed memory and knowledgebase surfaces for durable project context, recall, and agent notes.
- Moved canonical chat, response activity, and Hermes execution evidence into Tavern Runtime so chat history recovers cleanly across restarts.
- Added pinned chats, virtualized chat history, polished sidebar actions, and smoother Codex-style turn activity updates.
- Added skills and plugins inventory, managed agent instructions through AGENTS files, and aligned the skill catalog with the managed runtime.
- Updated managed Hermes to 2026.5.27 and removed stale Lossless Claw memory plugin wiring from the managed runtime config.
- Hardened installs, dependency pins, Tauri dependencies, and local Codex model auth.

## v1.0.1 - 2026-05-09

- Fixed signed Mac desktop releases failing to start the bundled Tavern server.
- Added the complete release publish command for future signed desktop releases.

## v1.0.0 - 2026-05-09

- Tavern is ready for its first signed Mac desktop release.
- Added a Tauri app build, notarization, S3 publishing, and updater metadata pipeline.
- Added in-app desktop update checks with an update-and-restart flow in Settings.
