---
summary: Process for Tavern-managed patches applied to the pinned Hermes engine install.
read_when:
  - changing managed Hermes live patches or the engine patch applicator
  - debugging managed Hermes behavior that differs from upstream Hermes
  - upgrading the Hermes engine while Tavern carries live patches
---

# Hermes Engine Patches

Tavern prefers upstream Hermes fixes. A live patch is allowed only when the
managed engine pin has a user-visible correctness bug and Tavern needs the
fixed contract before the next safe Hermes bump.

Live patches are product infrastructure, not local operator edits. Runtime
applies them to the managed install under `~/.tavern/engine/<pin>/hermes-agent`
while holding the engine install lock. Applied patch ids and checksums are
written to `~/.tavern/engine/<pin>/install.json`.

The patch manifest lives in `apps/runtime/src/hermes/engine-patches.ts`.

## Applicator Contract

Each entry in `managedHermesEnginePatches` is one logical upstream fix. A patch
can contain multiple file edits when those edits are required to deliver the
same fixed contract.

Each edit:

* names one target file inside the managed Hermes source tree
* matches the smallest exact upstream source block that proves the expected
  engine shape
* replaces only the lines required for the managed contract

Patch application is idempotent. If the replacement already exists, startup
continues. If the expected source block no longer exists, startup fails with a
managed-Hermes setup error. That failure is intentional: a changed upstream
file means the patch must be reviewed during the engine upgrade rather than
silently skipped.

`TAVERN_HERMES_BIN` and system-tier Hermes installs are not patched. Patches
apply only to Tavern-managed engine installs because those are the installs
Tavern acquires and pins.

## Patch Lifecycle

1. Add one patch entry per upstream correctness bug.
2. Keep the patch id stable and descriptive.
3. Use multiple edits in that one entry only when they fix the same contract.
4. Add or update a focused managed-engine bootstrap test.
5. Document the patch in `docs/patches/`.
6. Link the patch doc from the index below.
7. Run managed Runtime tests and a real managed-engine smoke when the bug needs
   live provider evidence.

Patch docs must state:

* the managed engine pin
* the user-visible symptom
* the upstream source shape
* the exact managed contract Tavern needs
* verification evidence
* when the patch can be removed

## Engine Upgrade Audit

Every Hermes engine pin update must audit live patches before shipping the
pin. The audit is always required; removal validation is only required when
the Hermes update gives strong evidence that upstream may now satisfy the
patched contract.

For each live patch:

1. Read the patch doc in `docs/patches/`.
2. Review the Hermes changelog, merged PRs, and changed source files that
   overlap the patch target or contract.
3. If the update does not touch the relevant contract, keep the patch and only
   update its source match if the upstream file shape changed.
4. If the update appears to fix the exact contract, temporarily remove only
   that patch entry from `apps/runtime/src/hermes/engine-patches.ts`.
5. Start from a clean managed install for the new pin, or run
   `tavern engine repair` when the install already exists and the patch source
   still matches.
6. Run the patch doc's removal-validation smoke exactly as written.
7. If the smoke passes without the patch, remove the patch entry, remove its
   index row below, and move or delete the patch doc according to whether the
   history is still useful.
8. If the smoke fails, keep the patch, update its source match for the new
   engine shape, and refresh the patch doc's upstream context and evidence.

Patch docs must make this audit runnable by a future updater. Each live patch
doc needs a `Removal Validation` section with:

* the precise user-visible bug that should reappear if upstream still lacks
  the fix
* setup steps to reproduce on an unpatched new pin
* pass/fail criteria
* database, log, or UI evidence to inspect
* cleanup steps for any real chats or sessions created by the smoke

If upstream has a related PR but does not cover the exact Tavern symptom, say
which gap remains. If the patch depends on provider credentials or account
state, state that too.

## Patch Index

| Status | Patch id | Docs |
| --- | --- | --- |
| Live | `gateway-default-model-runtime` | [Hermes default model runtime](../patches/hermes-default-model-runtime.md) |
| Retired candidate | `suppress-openai-codex-unstable-output-text-delta` | [OpenAI Codex stream delta candidate](../patches/openai-codex-stream-delta-retired.md) |
