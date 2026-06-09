# Hermes Installer Snapshot

`install.sh` is a verbatim snapshot of the official Hermes installer.

- Source: <https://hermes-agent.nousresearch.com/install.sh>
- Snapshot date: 2026-06-09
- Paired engine pin: `hermesPinnedCommit` in `apps/runtime/src/hermes/engine.ts`

Refresh this snapshot whenever the engine pin is bumped (see
`docs/operations/hermes-runtime-upgrade.md`). Runtime falls back to downloading
the script from the source URL when this asset is missing (source runs).
