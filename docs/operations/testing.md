---
summary: Testing strategy for Vitest defaults, contract-first API gates, Runtime chat store coverage, website e2e, OpenClaw contract tests, and smoke hygiene.
read_when:
  - adding tests, changing runtime contracts, or choosing a verification lane
  - changing OpenAPI, Runtime chat store, SDK, website e2e, or OpenClaw contract tests
---

# Testing

Tavern tests prove product behavior at the highest stable boundary we can
afford.

## Defaults

* Prefer Vitest for package-local tests.
* Prefer real temp SQLite databases, temp directories, and schema validation over
  module mocks.
* Mock only true external boundaries: model calls, process/container execution,
  network transports, time, and randomness.
* Do not write tests whose main assertion is that a spy was called.
* Add focused regression coverage for every production bug that changes
  behavior.

## Contract-First Order

Tavern follows the ClickClack testing shape for API work:

* **OpenAPI first.** Update `packages/tavern-api/openapi.yaml`.
* **Store next.** Add Runtime SQLite/store tests for ids, sequences,
  transactions, events, activity, and cursors.
* **Handlers next.** Runtime routes return OpenAPI-shaped payloads.
* **SDK next.** `@tavern/sdk` wraps the generated types and serializes requests.
* **Docs next.** Markdown explains behavior, not alternate schemas.
* **Gates last.** Run contract, store, handler, SDK, timeline, and e2e gates.

The contract package gate is:

```sh
bun run --filter @tavern/api check
```

The SDK gate is:

```sh
bun run --filter @tavern/sdk test
bun run --filter @tavern/sdk typecheck
```

## Runtime Chat Server Tests

The first runtime chat server slice proves the durable contract before app
timeline refactors.

Runtime tests cover:

* message create assigns per-chat sequence in the insert transaction
* duplicate `message.id` returns the existing message receipt
* duplicate `(chat_id, nonce)` returns the existing message receipt
* nonce reuse with different content fails clearly
* message create writes `message.created` in the same transaction
* delivery create writes a delivery receipt, assistant message, and
  `message.delivered` event in one transaction
* activity update stores latest state in `chat_activity` and emits
  `chat.activity.updated`
* activity completion closes active state without creating a transcript row
* read update is monotonic and emits a private `chat.read` event
* event replay returns records after cursor in ascending order

Use temp Runtime SQLite databases and the real Runtime chat store. Avoid module
mocks for table, transaction, idempotency, or cursor behavior.

## Runtime Tests

Runtime tests call the real Bun handler or a started local HTTP server against
temp state. Use a full started service when boot or process wiring is the thing
under test.

Runtime tests prove user-visible outcomes: JSON payloads, persisted records,
projected state, task transitions, and event delivery.

## Website E2E

Use Playwright against the real website and app backend.

The deterministic lane runs with:

* isolated ports
* isolated databases and runtime directories
* managed Tavern Runtime
* pinned OpenClaw Gateway
* vendored OpenClaw QA mock provider
* real Tavern Messenger plugin

Do not point deterministic e2e tests at a developer or production OpenClaw home.

## Chat Contract E2E

Chat responsiveness and message identity are product contracts. E2E coverage
proves:

* accepted user message appears once
* tool/progress activity appears before the final reply
* assistant preamble and reasoning summaries appear when OpenClaw emits them
* final assistant message appears once
* hard reloads recover durable history without flicker, reordering, duplicates,
  or missing messages
* hover/debug metadata stays hidden unless the message surface is hovered

Runtime chat server refactor e2e coverage also proves:

* reload reads the accepted user message from Runtime chat history
* websocket drop/reconnect recovers from event cursor plus durable history
* final OpenClaw transcript sync cannot create a second user row
* activity survives hard reload while the turn is active
* completed activity disappears without deleting durable messages

Keep timing thresholds limited to deterministic mock-provider runs. Live
OpenClaw smoke can print timing summaries, but does not fail normal CI on real
model latency.

## OpenClaw Contract Tests

When changing Gateway methods, events, channel behavior, or delivery semantics,
verify against shipped OpenClaw surfaces:

* `node_modules/openclaw/dist/server-methods-list-*.js`
* `node_modules/openclaw/docs/web/*`
* targeted runtime bundle inspection only for concrete ambiguities

Add raw-frame or fixture-backed tests for Gateway behavior Tavern depends on.
Do not rely on memory for event names or payload shape.

## Local Smoke

Manual real-runtime chats are rare. Prefer deterministic website e2e or
unit/integration tests.

If a manual smoke creates real Tavern chats, use an obvious temporary first
message, record the chat ids, and clean up only those chats.
