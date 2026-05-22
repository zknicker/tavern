# OpenClaw E2E Upgrade

This is the agent-driven upgrade checklist for the pinned OpenClaw e2e lane.

1. Pick the single OpenClaw version Tavern should target.
2. Update the root `openclaw` dev dependency to that exact version.
3. Update `packages/tavern-openclaw-messenger` to peer-depend on that exact version.
4. Refresh `mock-provider/server.ts` from the matching OpenClaw tag:
   `extensions/qa-lab/src/providers/mock-openai/server.ts`.
5. Keep the local import of `./close-http-server.ts` in the vendored provider.
6. Refresh `mock-provider/LICENSE.openclaw` from the same OpenClaw tag.
7. Complete the OpenClaw contract impact review in
   `docs/operations/openclaw-runtime-upgrade.md`.
8. Run `bun run --filter @tavern/website test:e2e`.
9. If Gateway config shape changed, update `openclaw/config.ts` to match the new source patterns.
10. If Tavern Messenger IPC changed, update the plugin and adapter first, then rerun e2e.
