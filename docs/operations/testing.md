---
summary: Testing strategy for choosing focused lanes, writing durable tests, keeping suites current, and avoiding unnecessary route or smoke coverage.
read_when:
  - adding tests, changing runtime contracts, or choosing a verification lane
  - changing OpenAPI, Runtime stores, SDK, app e2e, or managed runtime contract behavior
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
| App e2e | Browser-level app contracts: navigation, reload recovery, websocket reconnect, full chat identity, user flows, or layout-critical behavior. | Use deterministic Playwright against isolated ports, isolated DBs/runtime dirs, managed Runtime, real managed Hermes, and a mock model provider. |
| Runtime adapter tests | Hermes REST/SSE mapping, event projection, delivery semantics, managed lifecycle, or capability degradation. | Verify against Hermes API fixtures or the deterministic Hermes mock. Do not rely on memory for event names or payloads. |
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
* **Hermes adapter semantics:** use Hermes-shaped fixtures or the deterministic
  Hermes mock for the exact behavior Tavern depends on.

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
* Keep fixtures small and source-shaped. Use raw adapter frames or captured
  provider payloads when the product depends on exact external shape.
* For production bugs, add a focused regression at the boundary where the bug
  should have been impossible.

## App E2E

Use Playwright against the real app frontend and app backend for end-to-end contracts.
The deterministic lane must not point at a developer or production Hermes
home. It should use isolated ports, isolated databases, isolated runtime dirs,
managed Tavern Runtime, real managed Hermes, and the e2e OpenAI-compatible
model provider mock.

Chat e2e should prove identity and recovery, not styling details:

* accepted user message appears once
* tool/progress activity appears before the final reply and remains after reload
* assistant progress updates appear before and between tool activity when Hermes
  emits them
* thinking text is persisted and appears only when the Appearance setting enables
  inline thinking display
* final assistant message appears once
* reload and websocket reconnect recover without duplicates, missing rows, or
  ordering bugs
* completed activity remains available as durable response history
* hover/debug metadata stays hidden unless the message surface is hovered

The e2e wrapper runs preflight before Playwright starts service readiness
timers. Preflight verifies Playwright Chromium and builds the SDK with visible
terminal progress.

Keep timing thresholds limited to deterministic mock-provider runs. Live
Hermes smoke can print timing summaries, but should not fail normal CI on real
model latency.

## Runtime Adapter Contracts

When changing Hermes routes, SSE events, chat behavior, or delivery semantics,
verify against Hermes-shaped fixtures, the deterministic Hermes e2e mock, or the
official Hermes app source when a concrete ambiguity remains.

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

Cortex no longer has provider-backed live smoke lanes. Runtime tests should
cover hub resolution, topic listing, Markdown reads, search, and backlinks with
temporary Cortex wiki-style directories. Live wiki maintenance belongs to Cortex wiki
skill tests or operator-run Tasks.

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
