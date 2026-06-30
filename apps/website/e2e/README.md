# Website E2E

This folder holds Playwright coverage for user-facing app behavior.

## Lane

- The default lane runs the website, server, Tavern Runtime, and the local agent engine.
- Runtime's deterministic e2e language model drives inference for browser tests.
- Tests stay user-shaped: drive setup through the UI or real runtime contracts, then assert visible behavior over time.

## Chat Timing

New-chat responsiveness is covered with browser-visible marks for submit, optimistic route/sidebar/user message, thinking, final assistant message, duplicate final count, and hidden hover metadata. Those marks are enabled by the Playwright runtime flag only; the app should not emit permanent production timing logs for normal users.

## Layout

- `run-playwright.ts`: allocates unique ports and run ids for each Playwright run.
- `preflight.ts`: verifies Playwright Chromium before Playwright starts its `webServer` readiness timers.
- `start-tavern-server.ts`: boots the real Tavern server with a run-scoped SQLite database.
- `start-tavern-runtime.ts`: boots the real Tavern Runtime with a run-scoped data root.
- `support/test.ts`: shared Playwright exports.
- `tests/*.spec.ts`: user-facing specs grouped by surface area.

## Rules

- Do not point automated e2e tests at a developer or production agent home, config, or DB.
- Do not add mock-only product APIs for convenience.
- Keep expensive dependency setup in preflight, not Playwright `webServer` startup.
- Prefer one focused e2e regression over broad fixture setup and dozens of brittle assertions.
- When a regression depends on perceived chat responsiveness, assert both timing marks and visible UI state.
