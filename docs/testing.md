# Testing

Tavern tests should prove product behavior, not implementation trivia.

## Defaults

- Prefer Vitest for package-local tests.
- Prefer real state over mocked state.
- Prefer temp SQLite databases, temp directories, and real schema validation over module mocks.
- Test through the highest stable boundary you can afford.
- Keep pure logic pure so it can be tested directly without harnesses.

## Mocking Rules

- Avoid mocks by default.
- Mock only true external boundaries:
  - LLM or model calls
  - container and process execution
  - network transports
  - system time or randomness when determinism matters
- Do not mock Tavern-owned domain or storage modules in normal feature tests when a real in-memory
  or temp-backed test is practical.
- Do not write tests whose main assertion is that a spy was called.

## Primary Runtime Test Type

- For `apps/runtime`, the primary test type is service-level integration.
- Runtime integration tests should exercise Tavern-owned service behavior such as:
  - health and status responses
  - future memory APIs
  - future task APIs
  - future knowledgebase APIs
  - event streaming for Tavern-owned runtime events
- The normal runtime e2e shape is:
  - start with a temp SQLite database
  - start with temp runtime directories
  - seed only the minimum required initial state
  - call the real Tavern Runtime API handler or a started local HTTP server
  - assert on returned payloads and persisted state
- Use a full started service when boot or process wiring is the thing being tested.
- Use the real Bun handler directly when that proves the same product behavior more cheaply.

## Runtime Rules

- `apps/runtime` uses Vitest as the explicit test runner.
- Runtime tests should prefer calling the real Bun handler or local HTTP server over mocking
  `db.ts`, `state.ts`, or protocol modules.
- Runtime tests should use `_initTestDatabase()` or a temp SQLite file for persistent behavior.
- Runtime tests may stub network transports and model calls.
- Runtime tests should not mock protocol schemas from `packages/agent-runtime-protocol`.
- Runtime tests should verify user-visible outcomes such as JSON payloads, persisted records, and
  task state transitions.
- Runtime tests should avoid low-level implementation assertions when the same behavior can be
  proven through an e2e flow.

## Fixtures

- Keep fixtures explicit and small.
- Prefer builders or helper functions for `agent`, `chat`, and `task` records over repeated object
  blobs.
- Reset global state between tests.
- Use deterministic timestamps and ids when assertions depend on them.

## Regression Coverage

- Add a focused regression test for every production bug that changes behavior.
- Prefer the narrowest test that proves the failure is fixed.
- If a bug crosses storage and API boundaries, prefer an integration test over multiple mocked unit
  tests.

## Smaller Tests

- Pure helper tests are still useful for deterministic logic such as scheduling math, folder
  validation, and formatting.
- Keep these narrow and fast.
- Do not let small helper tests replace the runtime e2e flows that prove product behavior.

## App End-To-End Tests

- For dashboard e2e coverage, use Playwright against the real website and real server.
- Run the real Tavern Runtime and a pinned OpenClaw Gateway in a run-scoped temp home.
- Do not point Playwright at a production or developer OpenClaw.
- Mock only the model provider by using OpenClaw's vendored QA mock provider.
- Load the real Tavern Messenger OpenClaw plugin so Gateway IPC, plugin events, and runtime
  projection stay in the test boundary.
- Do not let the website e2e suite depend on ad hoc mock-only product APIs or JSON shapes.
- If a user-facing test needs OpenClaw behavior that the current Gateway contract does not expose,
  add that capability to the real Gateway adapter or Tavern Messenger plugin first.
- Keep app e2e tests user-shaped:
  - navigate to a page
  - perform a real UI action
  - assert on visible UI and live updates
- Keep the website e2e folder organized by responsibility:
  - test runner bootstrap and isolated ports
  - real server bootstrap with isolated databases
  - real Tavern Runtime bootstrap with isolated runtime data
  - pinned OpenClaw Gateway bootstrap with isolated state and config
  - vendored OpenClaw QA model provider
  - user-facing specs grouped by surface area

## Chat Latency Regressions

- Chat responsiveness is a product contract, not a best-effort polish check.
- The deterministic website e2e lane must include a new-chat latency regression that measures
  browser-visible milestones:
  - user submit
  - optimistic route/sidebar/user message visibility
  - thinking visibility
  - final assistant message visibility
  - duplicate final-message count
  - final-message hover metadata visibility while the pointer is not over the message
- Keep this timing instrumentation test-only. Gate browser timing capture behind the e2e runtime
  flag and avoid always-on production console logging.
- Deterministic e2e may enforce tight UI thresholds because the model provider and Gateway are
  controlled by the test harness. Use those thresholds only for Tavern render/event propagation, not
  for real model latency.
- Live OpenClaw timing should be captured as smoke evidence and contract debugging, not as default
  CI failure criteria. Live runs may warn or print timing summaries, but normal CI should not fail
  because a developer's local Gateway or model run is slow.
- The regression boundary is:
  - optimistic sidebar and user message should render within a few hundred milliseconds of submit
  - thinking should render within a few hundred milliseconds of the accepted/thinking event becoming
    available to Tavern
  - final UI should render within a few hundred milliseconds of the final runtime/plugin event
  - exactly one final assistant message should remain after the active reply becomes durable
  - hover metadata should stay hidden unless the actual message surface is hovered
- When a chat latency bug crosses the plugin, Gateway adapter, server event sync, and website UI,
  keep one end-to-end timing regression plus focused lower-level tests for the broken mapping or
  reconciliation behavior.

## OpenClaw Contract Tests

- When debugging or changing OpenClaw Gateway method/event behavior, use the shipped OpenClaw web
  contract for that specific question:
  - installed `node_modules/openclaw/dist/server-methods-list-*.js` for public RPC methods
  - installed `node_modules/openclaw/docs/web/*` for web client semantics
  - targeted dist/bundle inspection only when a concrete ambiguity remains
- Do not treat unrelated client docs as authoritative for Tavern's web/runtime integration tests.
- Add focused contract tests around raw Gateway frames for the cases Tavern depends on, especially:
  - `chat` delta/final/error delivery
  - `sessions.changed`, `session.message`, and `session.tool` invalidation
  - any Gateway RPC that Tavern explicitly requests
- For the Tavern Messenger plugin, contract tests must prove the current Gateway v4 channel-plugin
  shape rather than custom app-side shortcuts:
  - Tavern Messenger owns channel/session mapping and metadata
  - OpenClaw core owns the shared message send path
  - accepted, thinking/progress, final, and failed turns are projected through runtime events
  - durable transcript sync deduplicates any event/projection overlap
- Prefer real raw-capture fixtures over hand-written payload guesses when a production bug came
  from misunderstanding the Gateway surface.
- Keep raw local captures under `.context/openclaw-captures/`. Keep sanitized checked-in fixtures
  close to the adapter or e2e harness that uses them.

## Local OpenClaw Smoke Tests

- Manual development smoke tests may use the developer's local `~/.openclaw`.
- Treat that local OpenClaw home as disposable Tavern test state, not production data.
- Start the app with `bun run dev:runtime` and point `TAVERN_RUNTIME_URL` at
  `http://127.0.0.1:4310`.
- Tavern Runtime reads the local OpenClaw Gateway token from `OPENCLAW_GATEWAY_TOKEN` or
  `~/.openclaw/openclaw.json`; do not paste or commit the token in docs, tests, fixtures, or logs.
- It is valid for local smoke tests to install a ClawHub/GitHub skill, assign it to a local
  OpenClaw agent, verify `<workspace>/skills`, verify `skills.status`, and then delete the skill.
- The website e2e harness has two separate lanes:
  - the default deterministic lane uses the pinned temp OpenClaw Gateway plus mock provider
  - the live OpenClaw lane targets the developer's local Gateway for contract regressions that need
    real channel/runtime behavior
- Keep those lanes separate. Do not mix live-Gateway contract regressions into the deterministic
  mock-provider specs.
