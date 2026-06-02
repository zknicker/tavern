# Changelog

All notable changes to this project will be documented in this file.

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
- Fixed agent model settings so explicit non-preferred OpenClaw harness routes are preserved when reading and saving settings.

## v1.1.15 - 2026-06-01

- Fixed Tavern Runtime URL saves so unreachable URLs still persist in the app database and reopen with the configured URL.
- Fixed the desktop update indicator on onboarding so app updates are visible even when Runtime is disconnected or unreachable.

## v1.1.14 - 2026-06-01

- Added native Runtime notice rows for OpenClaw session and compaction notices, with an inspect drawer and regression coverage for both final delivery paths.
- Fixed OpenClaw verbose runtime notices leaking into assistant replies.
- Fixed managed OpenClaw plugin changes in the dev stack so plugin rebuilds are synced into the managed runtime.
- Fixed chat transcript scroll initialization in general chat.
- Added last-activity times to the temporary chat menu and sorted those chats by creation time.
- Refined dashboard shell tab styling.

## v1.1.13 - 2026-05-31

- Simplified Runtime model inventory to match OpenClaw's model catalog shape and removed unused model policy writes.
- Fixed model capability health so synced OpenClaw models report correctly and stale model snapshots self-heal.
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
- Updated the Homebrew Runtime service environment so managed OpenClaw and Codex commands can find Homebrew-installed binaries.

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
- Moved canonical chat, response activity, and OpenClaw execution evidence into Tavern Runtime so chat history recovers cleanly across restarts.
- Added pinned chats, virtualized chat history, polished sidebar actions, and smoother Codex-style turn activity updates.
- Added skills and plugins inventory, managed agent instructions through AGENTS files, and aligned the skill catalog with the managed runtime.
- Updated managed OpenClaw to 2026.5.27 and removed stale Lossless Claw memory plugin wiring from the managed runtime config.
- Hardened installs, dependency pins, Tauri dependencies, and local Codex model auth.

## v1.0.1 - 2026-05-09

- Fixed signed Mac desktop releases failing to start the bundled Tavern server.
- Added the complete release publish command for future signed desktop releases.

## v1.0.0 - 2026-05-09

- Tavern is ready for its first signed Mac desktop release.
- Added a Tauri app build, notarization, S3 publishing, and updater metadata pipeline.
- Added in-app desktop update checks with an update-and-restart flow in Settings.
