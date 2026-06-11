# Plan 002: Bound chat event reads with SQL-side visibility and LIMIT

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 0d1c19a2..HEAD -- apps/runtime/src/tavern/chat-api/events.ts apps/runtime/src/tavern/chat-api-router.ts apps/runtime/src/tavern/runtime-event-projection.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/001-ci-verification-gate.md (verification baseline)
- **Category**: perf
- **Planned at**: commit `0d1c19a2`, 2026-06-10

## Why this matters

`listEvents` in Tavern Runtime fetches **every** row in `chat_events` after the
cursor — no SQL `LIMIT` — then JSON-parses all of them and filters/slices in
JavaScript. The `chat_events` table is append-only and grows for the life of
the runtime, so every catch-up read from a low cursor (client reconnect,
event replay, the `GET /api/events` route — which currently passes **no
cursor at all**, so it always reads from cursor 0) scans and parses the entire
event history to return at most 500 events. On a long-lived always-on runtime
this becomes a full-table JSON-parse on a hot path. The fix pushes the
visibility filter and limit into SQL, where the data already has dedicated
columns (`is_private`, `recipients_json`) and `cursor` is the INTEGER PRIMARY
KEY (rowid), so the query is index-driven.

## Current state

- `apps/runtime/src/tavern/chat-api/events.ts` — the event store.
  `listEvents` (lines 24–48) as written today:

  ```ts
  export function listEvents(
      input: { afterCursor?: string | null; limit?: number; recipientId?: string | null } = {},
      db: Database = getDb()
  ) {
      const limit = clampLimit(input.limit);
      const rows = db
          .prepare(
              `SELECT event_json
               FROM chat_events
               WHERE cursor > $afterCursor
               ORDER BY cursor ASC`
          )
          .all(
              namedParams({
                  afterCursor: Number(input.afterCursor ?? 0),
              })
          ) as EventRow[];
      const visibleEvents = rows
          .map((row) => JSON.parse(row.event_json) as TavernChatEvent)
          .filter((event) => canReadEvent(event, input.recipientId));
      const events = visibleEvents.slice(0, limit);
      return {
          events,
          next_cursor: visibleEvents.length > limit ? (events.at(-1)?.cursor ?? null) : null,
      };
  }
  ```

  The same file defines `canReadEvent` (keep it — `publish()` still uses it):

  ```ts
  function canReadEvent(event: TavernChatEvent, recipientId: string | null | undefined) {
      if (!event.private) {
          return true;
      }
      return Boolean(recipientId && event.recipients.includes(recipientId));
  }
  ```

- Schema, `apps/runtime/src/db/schema.ts:130-143`:

  ```sql
  CREATE TABLE IF NOT EXISTS chat_events (
    cursor          INTEGER PRIMARY KEY,
    id              TEXT NOT NULL UNIQUE,
    event_type      TEXT NOT NULL,
    chat_id         TEXT NOT NULL,
    event_json      TEXT NOT NULL,
    created_at      TEXT NOT NULL,
    is_private      INTEGER NOT NULL DEFAULT 0 CHECK (is_private IN (0, 1)),
    recipients_json TEXT NOT NULL DEFAULT '[]',
    ...
  ```

  `is_private` and `recipients_json` are written by `insertEvent` in the same
  file and mirror `event.private` / `event.recipients` exactly.

- Callers of `listEvents` (only two, both in scope to re-verify, neither
  changes shape):
  - `apps/runtime/src/tavern/chat-api-router.ts:57-63` — `GET /api/events`
    route. **Note**: it passes `limit` and `recipientId` but no `afterCursor`:

    ```ts
    if (request.method === 'GET' && url.pathname === '/api/events') {
        return json(
            listEvents({
                limit: numberParam(url, 'limit'),
                recipientId: url.searchParams.get('recipient_id'),
            })
        );
    }
    ```

  - `apps/runtime/src/tavern/runtime-event-projection.ts:17-26` —
    `listProjectedTavernRuntimeEvents`, passes `afterCursor` and `limit`.

- `clampLimit` (`apps/runtime/src/tavern/chat-api/limits.ts`): clamps to
  `[1, 500]`, default 100.
- Existing tests: `apps/runtime/src/tavern/chat-api-store.test.ts` covers the
  chat-api store including events — model new tests on it. Runtime tests use
  vitest with real temp SQLite databases (repo convention: mock only true
  external boundaries).
- SQLite here is `bun:sqlite`; the JSON1 extension (`json_each`) is built into
  bun's bundled SQLite.

## Commands you will need

| Purpose   | Command                                  | Expected on success |
|-----------|------------------------------------------|---------------------|
| Install   | `bun install --frozen-lockfile`          | exit 0              |
| Runtime tests | `cd apps/runtime && bun run test`    | all pass            |
| One file  | `cd apps/runtime && bunx --bun vitest run src/tavern/chat-api-store.test.ts` | pass |
| Typecheck | `bun run --filter @tavern/runtime typecheck` | exit 0          |
| Lint      | `bun run lint`                           | exit 0              |

Runtime tests MUST run via bun (`bun run test`), never plain node vitest.

## Scope

**In scope** (the only files you should modify):
- `apps/runtime/src/tavern/chat-api/events.ts`
- `apps/runtime/src/tavern/chat-api-router.ts` (add `after_cursor` param parse)
- `apps/runtime/src/tavern/chat-api-store.test.ts` (add tests)

**Out of scope** (do NOT touch):
- `publish()` / `subscribeToTavernApiEvents` in events.ts — the in-memory
  fan-out path is fine and still needs `canReadEvent`.
- `packages/tavern-api` — only touch it if the OpenAPI/contract source there
  explicitly defines the `GET /api/events` query params (check with
  `grep -rn "api/events" packages/tavern-api/src`); if it does, add the
  optional `after_cursor` param there too, regenerate via
  `bun run --filter @tavern/api build`, and include it in the commit.
- Event retention/pruning — a real follow-up, but a separate decision.
- `runtime-event-projection.ts` — it already passes a cursor; no change.

## Git workflow

- Conventional Commits, e.g. `perf: push chat event visibility and limit into SQL`.
- Do NOT push unless the operator instructed it.

## Steps

### Step 1: Push visibility + limit into the SQL query

Rewrite the query in `listEvents` so visibility and limit are SQL-side, and
fetch `limit + 1` rows to compute `next_cursor`:

```ts
const limit = clampLimit(input.limit);
const rows = db
    .prepare(
        `SELECT event_json
         FROM chat_events
         WHERE cursor > $afterCursor
           AND (
             is_private = 0
             OR EXISTS (
               SELECT 1 FROM json_each(chat_events.recipients_json)
               WHERE json_each.value = $recipientId
             )
           )
         ORDER BY cursor ASC
         LIMIT $limit`
    )
    .all(
        namedParams({
            afterCursor: Number(input.afterCursor ?? 0),
            limit: limit + 1,
            recipientId: input.recipientId ?? null,
        })
    ) as EventRow[];
const events = rows.slice(0, limit).map((row) => JSON.parse(row.event_json) as TavernChatEvent);
return {
    events,
    next_cursor: rows.length > limit ? (events.at(-1)?.cursor ?? null) : null,
};
```

Semantics must match `canReadEvent` exactly: public events visible to
everyone; private events visible only when `recipientId` is non-null and in
the recipients list. (`json_each.value = NULL` is never true in SQL, which
matches the JS behavior for a missing recipientId.) Keep `canReadEvent` —
`publish()` uses it.

**Verify**: `cd apps/runtime && bunx --bun vitest run src/tavern/chat-api-store.test.ts` → existing tests pass.

### Step 2: Accept `after_cursor` on the HTTP route

In `chat-api-router.ts`, pass the cursor through:

```ts
listEvents({
    afterCursor: url.searchParams.get('after_cursor'),
    limit: numberParam(url, 'limit'),
    recipientId: url.searchParams.get('recipient_id'),
})
```

Check `packages/tavern-api` for a contract definition of this route (see
Scope) and mirror the optional param if one exists.

**Verify**: `bun run --filter @tavern/runtime typecheck` → exit 0.

### Step 3: Add tests

In `chat-api-store.test.ts`, following its existing structure (real temp
SQLite db per test), add:

1. **Visibility parity**: insert a mix of public events, private events with
   recipient `A`, private with recipient `B`; assert `listEvents({recipientId: 'A'})`
   returns public + A-private only, and `listEvents({})` returns public only.
2. **Limit + next_cursor**: insert `limit + 2` visible events; assert exactly
   `limit` returned and `next_cursor` equals the last returned event's cursor;
   then page with `afterCursor: next_cursor` and assert the remainder arrives
   and final `next_cursor` is `null`.
3. **Private events don't consume the page**: insert 5 private events (for
   someone else) followed by 3 public ones; assert `listEvents({limit: 3})`
   returns all 3 public events (the old code already behaved this way; this
   pins the SQL rewrite to it).

**Verify**: `cd apps/runtime && bun run test` → all pass including 3 new tests.

## Test plan

Covered in Step 3 — three new cases in
`apps/runtime/src/tavern/chat-api-store.test.ts`, modeled on the file's
existing temp-db tests.

## Done criteria

- [ ] `listEvents` SQL contains `LIMIT` and the visibility predicate; no JS
      `.filter(canReadEvent)` remains inside `listEvents`
- [ ] `GET /api/events` honors `after_cursor`
- [ ] `cd apps/runtime && bun run test` exits 0 with the 3 new tests
- [ ] `bun run --filter @tavern/runtime typecheck` and `bun run lint` exit 0
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- `json_each` errors under `bun:sqlite` in tests (would mean bun's SQLite was
  built without JSON1 — not expected, but verify rather than work around).
- Existing tests in `chat-api-store.test.ts` assert the old next_cursor
  behavior in a way that contradicts the excerpt above (drift).
- The tavern-api contract defines `GET /api/events` with a *different* cursor
  param name — report instead of inventing one.

## Maintenance notes

- If event retention/pruning is added later, `next_cursor` semantics here
  (cursor-gap tolerant: `cursor > after`) already survive deleted rows.
- Reviewer should scrutinize the SQL visibility predicate against
  `canReadEvent` — they must stay semantically identical, and `publish()`
  still uses the JS version.
- Deferred: pruning/retention of `chat_events`, and pagination support in any
  SDK wrapper for the events route.
