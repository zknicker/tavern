---
summary: Testing strategy for choosing focused lanes, writing durable tests, keeping suites current, and avoiding unnecessary route or smoke coverage.
read_when:
  - adding tests, changing runtime contracts, or choosing a verification lane
  - changing OpenAPI, Runtime stores, SDK, app e2e, or OpenClaw contract behavior
---

# Testing

Use the smallest test lane that can fail for the bug or behavior you changed.
Prefer tests at the owner of the rule: domain logic, store, service, hook, or
e2e flow.

## Quick Start

Most changes need a narrow behavior test plus the relevant typecheck or lint
gate.

```sh
bun run lint
bun run --filter @tavern/runtime test
bun run --filter @tavern/server test
bun run --filter @tavern/website typecheck
bun run --filter @tavern/api check
bun run --filter @tavern/sdk test
bun run test:e2e
```

Run only the lanes that cover the touched behavior. Before handoff, report the
commands you ran and anything you did not verify.

## Test Lanes

| Lane | Use when | Keep current by |
| --- | --- | --- |
| Focused unit/domain tests | Pure logic, view models, hooks, mappers, scheduling rules, validation, or regressions. | Add one targeted regression for behavior changes. Avoid asserting implementation calls. |
| Runtime store/service tests | Persistence, ids, ordering, idempotency, transactions, recovery, Cortex, chat, cron, jobs, or execution evidence. | Use real temp SQLite/temp dirs and the real store/service. Do not mock tables or transaction behavior. |
| Runtime handler tests | Boot, process wiring, HTTP payload shape, event delivery, or route-owned error/auth/transport behavior. | Use the real Bun handler or a started local service only when the handler owns meaningful behavior. |
| Contract/API/SDK gates | `packages/tavern-api`, OpenAPI, SDK client shape, generated types, or cross-boundary request/response contracts. | Run `@tavern/api check`, SDK tests/typecheck, and update docs with the product contract. |
| App component/hook tests | React state rules, cache invalidation, optimistic UI, row models, filters, keyboard behavior, or rendering transforms. | Prefer hook/model/component tests before e2e. Use the `react-best-practices` skill for nontrivial React architecture. |
| App e2e | Browser-level app contracts: navigation, reload recovery, websocket reconnect, full chat identity, user flows, or layout-critical behavior. | Use deterministic Playwright against isolated ports, isolated DBs/runtime dirs, managed Runtime, pinned OpenClaw, and mock provider. |
| OpenClaw contract tests | Gateway RPCs, events, channel behavior, delivery semantics, managed config, plugin lifecycle, or capability degradation. | Verify against shipped OpenClaw method lists/docs/fixtures/raw frames. Do not rely on memory for event names or payloads. |
| Live/manual smoke | Real provider behavior, local environment diagnosis, or release confidence that deterministic lanes cannot cover. | Keep opt-in. Record temporary chat ids/titles and clean up only those records. |

## Lane Selection

Choose the smallest lane that proves the changed behavior.

* **Domain behavior or invariant:** test the owner: domain, store, service, hook,
  or view model.
* **Contract shape:** run the owning contract/typecheck gate. Add tests only
  when the contract carries validation, compatibility, or generated-client risk.
* **Thin route or tRPC procedure:** do not add route tests just because a route
  exists. Test the called domain behavior unless the route owns auth, coercion,
  error mapping, streaming, or transport semantics.
* **Frontend state or rendering rule:** prefer hook/model/component tests. Use
  e2e for browser-level contracts and real user flows.
* **OpenClaw or Gateway semantics:** use shipped OpenClaw surfaces or raw-frame
  fixtures for the exact behavior Tavern depends on.

## Writing Tests

* Prefer Vitest for package-local tests unless the package already uses Bun
  tests.
* Prefer real temp SQLite databases, temp directories, and schema validation
  over module mocks.
* Mock only true external boundaries: model calls, process/container execution,
  network transports, time, and randomness.
* Assert user-visible or contract-visible outcomes: persisted rows, emitted
  events, returned JSON, cache state, rendered rows, or task transitions.
* Do not write tests whose main assertion is that a spy was called.
* Keep fixtures small and source-shaped. Use raw Gateway frames or captured
  provider payloads when the product depends on exact external shape.
* For production bugs, add a focused regression at the boundary where the bug
  should have been impossible.

## App E2E

Use Playwright against the real app frontend and app backend for end-to-end contracts.
The deterministic lane must not point at a developer or production OpenClaw
home. It should use isolated ports, isolated databases, isolated runtime dirs,
managed Tavern Runtime, pinned OpenClaw Gateway, and the vendored mock provider.

Chat e2e should prove identity and recovery, not styling details:

* accepted user message appears once
* tool/progress activity appears before the final reply and remains after reload
* assistant preamble and reasoning summaries appear when OpenClaw emits them
* final assistant message appears once
* reload and websocket reconnect recover without duplicates, missing rows, or
  ordering bugs
* completed activity remains available as durable response history
* hover/debug metadata stays hidden unless the message surface is hovered

The e2e wrapper runs preflight before Playwright starts service readiness
timers. Preflight verifies Playwright Chromium and the managed OpenClaw
package/plugin cache with visible terminal progress.

Keep timing thresholds limited to deterministic mock-provider runs. Live
OpenClaw smoke can print timing summaries, but should not fail normal CI on real
model latency.

## OpenClaw Contracts

When changing Gateway methods, events, channel behavior, or delivery semantics,
verify against shipped OpenClaw surfaces:

* `node_modules/openclaw/dist/server-methods-list-*.js`
* relevant `node_modules/openclaw/docs/web/*`
* targeted Gateway/runtime bundle inspection only for concrete ambiguities

Add raw-frame or fixture-backed tests for behavior Tavern depends on.

## Manual Smoke Hygiene

Manual real-runtime chats are rare. Prefer deterministic e2e or unit/integration
tests.

If manual validation creates real Tavern chats, use an obvious temporary first
message such as `Codex smoke <timestamp>: <purpose>`, record the created chat
ids, and delete only those chats before finishing. If cleanup fails, report the
exact chat ids or titles left behind.

## Live Provider Smoke

Live provider tests are opt-in. They are not part of normal CI or default local
test lanes because they spend provider credits and depend on local tools,
network, and account state.

Cortex source import has a live OpenAI smoke lane:

```sh
bun run --filter @tavern/runtime smoke:cortex-verify
bun run --filter @tavern/runtime smoke:cortex-import
```

Additional live lanes:

```sh
bun run --filter @tavern/runtime smoke:cortex-real-import
bun run --filter @tavern/website smoke:cortex-agent-lookup
```

Runtime source-import smoke requirements:

* `OPENAI_API_KEY` in the local ignored `.env` file or Runtime process
  environment.
* macOS `say` for generating a tiny speech sample.
* `ffmpeg` for converting the speech sample to WAV.
* ImageMagick `convert` for generating an OCR image.

The agent lookup lane requires local managed OpenClaw with working Codex auth.

The smoke test creates a temporary Cortex database and wiki, generates a tiny
text PDF, a PNG with visible text, and a WAV speech sample, then imports each
through the real Cortex source import path. The PDF proves local extraction; the
PNG and WAV call real OpenAI OCR and transcription. Assertions verify that
Cortex pages, source refs, raw file refs, normalized content, and model metadata
are written as expected.

The verify lane writes a W3C-cited accessibility knowledge page into a temporary
Cortex wiki, syncs it into PGLite, generates real OpenAI embeddings, edits the
markdown, syncs again, and proves search plus recall return the updated page. It
can write input/output JSON by setting `TAVERN_CORTEX_VERIFY_SMOKE_OUTPUT`.

The agent lookup lane runs the live OpenClaw e2e harness, seeds a unique Cortex
page through Runtime, asks the agent about that unique fact in chat, and verifies
the OpenClaw trajectory used `cortex_recall`, `cortex_search`, or
`cortex_get_page` before the answer.

The real-source lane downloads a NASA podcast MP3, a Wikimedia Commons
infographic PNG, and a W3C sample PDF into a temporary directory. It trims the
podcast to a 10 second WAV clip, imports all three sources, and verifies the
distilled Cortex pages contain expected text from the real sources. It can write
a JSON summary by setting `TAVERN_CORTEX_LIVE_REAL_SMOKE_OUTPUT`.

## Keeping Suites Current

* Add tests with the feature or bug fix, not in a later cleanup.
* Delete or rewrite tests when the product contract changes; do not preserve
  stale assertions to keep old behavior alive.
* Update docs when a new lane, mock provider behavior, fixture source, or
  verification command becomes the preferred path.
* Keep e2e focused on durable product contracts. Move logic regressions down to
  unit, hook, store, or service tests when possible.
* If a lane becomes flaky, either fix the product/test boundary or move the
  unstable part into an explicit live/manual lane.
