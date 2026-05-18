---
read_when:
  - bumping the managed OpenClaw version Tavern Runtime launches
  - changing managed OpenClaw state, generated config, or upgrade verification
---

# OpenClaw Runtime Upgrade

Upgrades are Tavern migrations. Preserve `~/.tavern` backup semantics and keep
the projection namespace stable as `tavern-openclaw-managed`.

## Flow

1. Pick the OpenClaw npm version.
2. Confirm the version exists:
   ```bash
   bun pm view openclaw versions --json
   ```
3. Update the root dev dependency:
   ```bash
   bun add -d openclaw@<version>
   ```
4. Update `packages/tavern-openclaw-messenger` peer/runtime versions when
   needed, then run `bun install`.
5. Update `apps/runtime/src/openclaw/version.ts` and version-specific tests.
6. Read OpenClaw release notes for Gateway, event, config, plugin, and state
   changes.
7. Update generated config, Gateway adapter mappings, tests, and website e2e
   mock provider fixtures when the contract changes.
8. Add a runtime-state migration only when OpenClaw-owned state cannot be
   regenerated or resynced.
9. Run verification.

## State Rules

* `~/.tavern/runtime/openclaw/versions/<version>` is an npm cache.
* `~/.tavern/runtime/openclaw/run/openclaw.json` is generated.
* `~/.tavern/runtime/openclaw/run/state` is managed OpenClaw state.
* `~/.tavern/tavern.sqlite` is Tavern durable state.
* Projection rows remain scoped to `tavern-openclaw-managed`.

Prefer regenerating OpenClaw config over patching old config files.

## Verification

```bash
bun run --filter @tavern/runtime lint
bun run --filter @tavern/runtime typecheck
bun run --filter @tavern/runtime test
bun run --filter @tavern/server typecheck
bun run --filter @tavern/openclaw-gateway-adapter test
bun run test:e2e:live-openclaw
```

For state or config upgrades, also smoke with a copied `~/.tavern` tree and
confirm runtime status, Gateway startup, generated config, projected archive
visibility, and fresh OpenClaw sync.
