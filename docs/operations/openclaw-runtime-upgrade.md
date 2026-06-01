---
summary: Managed OpenClaw upgrade workflow for npm version bumps, generated config, state rules, runtime namespace, migrations, and verification gates.
read_when:
  - bumping the managed OpenClaw version Tavern Runtime launches
  - changing managed OpenClaw state, generated config, or upgrade verification
---

# OpenClaw Runtime Upgrade

Upgrades are Tavern migrations. Preserve `~/.tavern` backup semantics and keep
the runtime namespace stable as `tavern-openclaw-managed`.

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
4. Update first-party OpenClaw plugin peer/runtime versions when needed, using
   exact versions. Then run `bun install --frozen-lockfile` to verify the lock
   remains consistent.
5. Update `apps/runtime/src/openclaw/version.ts` and version-specific tests.
6. Read OpenClaw release notes and Tavern's [feature docs](../features/) to
   look for features that overlap with Tavern behavior.
7. If OpenClaw added or changed a feature Tavern already models, update the
   owning Tavern spec before changing code.
8. Update generated config, Gateway adapter mappings, tests, and website e2e
   mock provider fixtures when the contract changes.
9. Run the Tavern Messenger final-payload classification regressions. These
   guard OpenClaw verbose/status payloads such as new-session and
   auto-compaction notices so they keep mapping to `runtimeNotice` activity
   instead of assistant messages:
   ```bash
   bun run --filter @zknicker/tavern-openclaw-messenger typecheck
   ```
10. Add a runtime-state migration only when OpenClaw state cannot be
   regenerated or resynced.
11. Run verification.

## Feature Overlap Review

Every OpenClaw upgrade should include a quick feature overlap check. The basic
question is: did OpenClaw add or change something that conflicts with, replaces,
or improves a Tavern-owned feature?

Start from Tavern's [feature docs](../features/) so the review is anchored in
what the product exposes, not just implementation details. Use specs and
internals docs to resolve ownership once an overlap is found.

If the answer is yes, update the owning Tavern spec before changing code. The
spec should say whether Tavern keeps its current behavior, adopts the OpenClaw
behavior, or supports both during a transition.

Common overlap areas:

* chats, sessions, turns, and transcript history
* Gateway methods and events
* generated OpenClaw config
* Tavern Messenger plugin behavior
* skills, tools, plugins, and app capabilities
* user input features such as `@` mentions, file references, images,
  screenshots, and attachments

For example, if OpenClaw adds native `@` mention support, update
[Mentions](../../specs/mentions.md) first. Then decide whether Tavern should
keep projecting prompt hints itself, map mentions to OpenClaw's native support,
or bridge both shapes temporarily.

## State Rules

* `~/.tavern/runtime/openclaw/versions/<version>` is an npm cache.
* `~/.tavern/runtime/openclaw/run/openclaw.json` is generated.
* `~/.tavern/runtime/openclaw/run/state` is managed OpenClaw state.
* `~/.tavern/tavern.sqlite` is Tavern durable state.
* Runtime-backed rows remain scoped to `tavern-openclaw-managed`.

Prefer regenerating OpenClaw config over patching old config files.

## Verification

```bash
bun run --filter @tavern/runtime lint
bun run --filter @tavern/runtime typecheck
bun run --filter @tavern/runtime test
bun run --filter @tavern/server typecheck
bun run --filter @zknicker/tavern-openclaw-messenger typecheck
bun run --filter @tavern/openclaw-gateway-adapter test
bun run test:e2e:live-openclaw
```

For state or config upgrades, also smoke with a copied `~/.tavern` tree and
confirm runtime status, Gateway startup, generated config, archived records
visibility, and fresh OpenClaw sync.
