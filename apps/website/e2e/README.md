# Website E2E

This folder holds Playwright coverage for user-facing dashboard behavior.

## Lanes

- Default deterministic lane:
  - run the real website, real server, real Tavern Runtime, and Runtime-managed OpenClaw Gateway
  - mock only the model provider by using OpenClaw's vendored QA mock OpenAI-compatible server
  - load the real Tavern Messenger OpenClaw plugin from `packages/tavern-openclaw-messenger`
  - enforce browser-visible chat latency thresholds with test-only timing instrumentation
- Live OpenClaw lane:
  - run the real website, real server, and real Tavern Runtime against the developer's local
    managed OpenClaw Gateway
  - do not start the mock provider or the pinned temp Gateway
  - use this only for regressions that need the real local OpenClaw contract or channel behavior
  - print timing evidence for manual review, but do not make normal CI depend on live model latency
- Keep tests user-shaped: drive setup through the UI or real runtime contracts, then assert on
  visible behavior over time.

## Chat Timing

New-chat responsiveness is covered in the deterministic lane. The test captures browser-visible
marks for submit, optimistic route/sidebar/user message, thinking, final assistant message, duplicate
final count, and hidden hover metadata. Those marks are enabled by the Playwright runtime flag only;
the app should not emit permanent production timing logs for normal users.

The deterministic test may fail on tight Tavern UI thresholds because the mock provider and Gateway
are controlled. The live lane should be used when debugging real OpenClaw plugin/channel behavior or
recording raw Gateway event timing, but live timing should be treated as smoke evidence rather than a
default CI gate.

## Layout

- `run-playwright.ts`: allocates unique ports and run ids for each Playwright run.
- `run-playwright-live-openclaw.ts`: boots the live local OpenClaw lane with isolated Tavern ports.
- `start-tavern-server.ts`: boots the real Tavern server with a run-scoped SQLite database.
- `start-tavern-runtime.ts`: boots the real Tavern Runtime with a run-scoped data root.
- `openclaw/start-mock-provider.ts`: starts the vendored OpenClaw QA mock provider.
- `openclaw/start-gateway.ts`: legacy standalone Gateway harness kept for targeted contract work;
  the default lane uses Runtime-managed OpenClaw.
- `openclaw/gateway-capture.ts`: connects to a real Gateway, records raw event frames, and can
  write captures under `.context/openclaw-captures/`.
- `openclaw/mock-provider/`: vendored OpenClaw QA provider from the pinned OpenClaw tag.
- `support/test.ts`: shared Playwright exports.
- `tests/*.spec.ts`: user-facing specs grouped by surface area.
- `live/*.spec.ts`: live OpenClaw-only regressions.

## Rules

- Do not point automated e2e tests at a developer or production OpenClaw home.
- Do not add mock-only product APIs for convenience.
- Keep model responses deterministic by using prompt directives supported by the OpenClaw QA mock.
- Prefer one focused e2e regression over broad fixture setup and dozens of brittle assertions.
- When a regression depends on real Gateway method/event semantics, capture the raw Gateway frames
  alongside the browser assertions so the test proves contract behavior directly.
- When a regression depends on perceived chat responsiveness, assert both timing marks and visible
  UI state. Timing alone is not enough if the user can still see duplicate, blank, or flickering
  transcript state.
- When OpenClaw publishes a better typed SDK or official contract surface, update this README and
  `docs/testing.md` so the live-lane guidance points at that newer source of truth.
