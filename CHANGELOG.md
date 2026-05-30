# Changelog

All notable changes to this project will be documented in this file.

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
