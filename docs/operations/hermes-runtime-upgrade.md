---
summary: Managed Hermes upgrade workflow for bumping the engine pin and installer snapshot, generated config, model-provider setup, adapter mappings, state rules, runtime namespace, and verification gates.
read_when:
  - upgrading the Hermes engine Tavern Runtime launches (bumping the pin + installer snapshot)
  - changing managed Hermes state, generated config, model setup, adapter mapping, or upgrade verification
  - cleaning up old engine installs under ~/.tavern/engine after a pin bump
---

# Hermes Runtime Upgrade

Hermes upgrades are Runtime integration changes. Tavern keeps the runtime
namespace stable as `tavern-hermes-managed`, starts a managed Hermes dashboard,
and maps Hermes sessions, turns, tools, thinking, and assistant output into
Tavern Runtime records.

## Flow

1. Pick the target Hermes commit.
2. Bump `hermesPinnedCommit` in `apps/runtime/src/hermes/engine.ts` and refresh
   the bundled installer snapshot at `apps/runtime/assets/hermes/installer/`
   (update its `SOURCE.md`). For local validation against a specific install,
   set `TAVERN_HERMES_BIN` or `TAVERN_HERMES_COMMIT` instead of editing code.
3. Start the dev stack and confirm Runtime resolves the intended binary
   (`tavern engine status` shows the resolved tier and pin):
   ```bash
   bun run dev
   ```
4. Read Hermes release notes and Tavern's [feature docs](../features/) for
   behavior that overlaps with Tavern-owned chat, model, settings, tools, or
   activity surfaces.
5. If Hermes changed a behavior Tavern already models, update the owning Tavern
   spec before changing code.
6. Update generated managed workspace/config code when Hermes changes expected
   home, workspace, auth, model, or instruction files.
7. Update capability checks when Hermes changes `/api/status`, `/api/sessions`,
   `/api/ws`, `/api/model/options`, or `/api/skills`.
8. Update adapter mappings when Hermes changes stream events for assistant text,
   assistant status, reasoning, tool progress, tool lifecycle, errors, or turn
   completion.
9. Update model-provider setup when Hermes changes provider ids, auth storage,
   model selection, custom provider config, or Codex OAuth state.
10. Update the e2e model-provider mock only when the Hermes-to-provider request
    or response contract changes. Keep the real managed Hermes stack live in
    e2e.
11. Add a runtime-state migration only when Hermes state cannot be regenerated
    or resynced.
12. Run verification.

## Feature Overlap Review

Every Hermes upgrade should include a quick feature overlap check. The basic
question is: did Hermes add or change something that conflicts with, replaces,
or improves a Tavern-owned feature?

Start from Tavern's [feature docs](../features/) so the review is anchored in
what the product exposes, not just implementation details. Use specs and
internals docs to resolve ownership once an overlap is found.

If the answer is yes, update the owning Tavern spec before changing code. The
spec should say whether Tavern keeps the current behavior or adopts the Hermes
behavior.

Common overlap areas:

* chats, sessions, turns, and transcript history
* dashboard/API/Gateway routes and events
* generated managed workspace and Hermes config
* model providers, model options, and Codex OAuth state
* skills, tools, plugins, and app capabilities
* assistant status updates, thinking text, tool progress, and final replies
* user input features such as `@` mentions, file references, images,
  screenshots, and attachments

For example, if Hermes adds native `@` mention support, update
[Mentions](../../specs/mentions.md) first. Then decide whether Tavern should
keep projecting prompt hints itself or map mentions to Hermes's native support.

## State Rules

* `~/.tavern/engine/<pin>` holds managed engine installs, shared across
  worktrees. There is no automatic cleanup; remove old pins with
  `tavern engine clean` after a pin bump. A deployed host pre-stages the new
  pin during `tavern update`; otherwise the first restart after a pin bump
  installs the engine and takes longer.
* `~/.tavern/runtime` is the default Runtime root and backup unit.
* `~/.tavern/runtime/hermes/home` is the default managed `HERMES_HOME`.
* `~/.tavern/runtime/hermes/workspace` is the generated managed workspace.
* `~/.tavern/runtime/data/runtime.db` is Tavern Runtime durable state.
* The Cortex wiki hub is durable Cortex knowledge. Runtime resolves it from
  `TAVERN_WIKI_HUB_PATH`, `TAVERN_CORTEX_WIKI_PATH`, or the managed Runtime
  wiki root.
* Dev stack state is isolated under `~/.tavern/dev/<worktree-id>/`.
* Runtime-backed Hermes rows remain scoped to `tavern-hermes-managed`.

Prefer regenerating Hermes config and workspace files over patching old files.

## Verification

```bash
bun run --filter @tavern/runtime typecheck
bun run --filter @tavern/runtime test
bun run --filter @tavern/server typecheck
bun run --filter @tavern/website test:e2e -- tests/hermes-tavern-chat-contract.spec.ts
```

For state or config upgrades, also smoke with a copied Runtime root and confirm
runtime status, dashboard/API/Gateway startup, model options, capability health,
archived records visibility, and fresh Hermes turn execution.
