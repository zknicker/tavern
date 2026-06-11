# Plan 004: Stop building every chat to serve one — single-chat lookup path

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 0d1c19a2..HEAD -- apps/server/src/chat/list.ts`
> If it changed since this plan was written, compare the "Current state"
> excerpts against the live code before proceeding; on a mismatch, treat it
> as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED — the chat projection logic is subtle (identity resolution,
  archived filtering, external sessions); the safe shape is filtering inputs,
  not re-implementing projection
- **Depends on**: plans/001-ci-verification-gate.md (verification baseline)
- **Category**: perf
- **Planned at**: commit `0d1c19a2`, 2026-06-10

## Why this matters

`getChat` — the procedure behind opening a single chat — currently calls
`listChatDetails()`, which fetches **all** agents, **all** participants,
**all** runtime sessions, and **all** runtime chat records, projects every
chat in the system into its presentation shape, and then does a linear
`.find()` for the one requested id. Every chat open pays for the whole
library. The cost grows linearly with chat count and `getChat` is invalidated
on realtime events, so it re-runs often. The fix: let callers pass a
`chatId` filter that is applied to the *inputs* of the projection (sessions
and chat records) so the existing projection logic runs over one chat's data
instead of all of it — without changing the projection logic itself or the
response shape.

## Current state

- `apps/server/src/chat/list.ts` (629 LoC) — the chat list/projection module.
  The entry points (lines 188–203):

  ```ts
  export async function listChats() {
      const chats = await listChatDetails({ includeExternal: false });
      const itemsById = Object.fromEntries(chats.map((chat) => [chat.id, toChatListItem(chat)]));
      return chatListSchema.parse({ ids: chats.map((chat) => chat.id), itemsById });
  }

  export async function getChat(input: { chatId: string }) {
      const chats = await listChatDetails({ includeExternal: false });
      const chat = chats.find((entry) => entry.id === input.chatId) ?? null;
      return chat ? chatSchema.parse(chat) : null;
  }
  ```

  And the fan-out (lines 205–214):

  ```ts
  export async function listChatDetails(options?: { includeExternal?: boolean }) {
      const includeExternal = options?.includeExternal ?? true;
      const [agents, participants, sessions, chatRecords] = await Promise.all([
          listAgents(),
          listParticipants(),
          listRuntimeSessions(),
          listRuntimeChatRecords({ includeArchived: true, includeExternal }),
      ]);
  ```

  Downstream of the fan-out, the function builds: `archivedChatIds` (from
  chat metadata), `agentRuntimeChatsById`, a participant-id map via
  `buildRuntimeParticipantIdMap`, `sessionsByChatId`, then a `chatIds` set
  combining runtime chats + (when `includeExternal`) chat ids inferred from
  non-tavern sessions, and finally maps each id through identity resolution
  and presentation.

- `agents` and `participants` are small reference tables used as lookup maps
  (`agentById`, `participantById`) — keep fetching them whole; do NOT try to
  filter them.
- The heavy inputs are `listRuntimeSessions()` and
  `listRuntimeChatRecords(...)` — find their definitions with
  `grep -rn "export.*function listRuntimeSessions\|export.*function listRuntimeChatRecords" apps/server/src`
  (expected under `apps/server/src/chat/` or `apps/server/src/storage/` /
  `apps/server/src/rows/`). Inspect whether each is a drizzle query you can
  add a `WHERE chat_id = ?` / `WHERE id = ?` to.
- Existing tests: `ls apps/server/test | grep -i chat` — there are chat-list
  tests in `apps/server/test/` (e.g. chat-list/projection coverage; find the
  exact file with `grep -rln "listChatDetails\|getChat" apps/server/test`).
  Server tests run with `bun:test` against real temp SQLite (see
  `apps/server/test/agent-runtime-event-sync.test.ts` for the harness style).

## Commands you will need

| Purpose   | Command                                  | Expected on success |
|-----------|------------------------------------------|---------------------|
| Install   | `bun install --frozen-lockfile`          | exit 0              |
| Server tests | `cd apps/server && bun run test`      | all pass            |
| One file  | `cd apps/server && bun test test/<file>.test.ts` | pass        |
| Typecheck | `bun run --filter @tavern/server typecheck` | exit 0           |
| Lint      | `bun run lint`                           | exit 0              |

## Scope

**In scope**:
- `apps/server/src/chat/list.ts`
- The storage modules that define `listRuntimeSessions` and
  `listRuntimeChatRecords` (add an optional `chatId` filter to each)
- The existing chat-list test file in `apps/server/test/` (extend)

**Out of scope** (do NOT touch):
- The projection logic inside `listChatDetails` (identity resolution,
  archived filtering, participant mapping, presentation helpers like
  `presentDiscordChannelName`) — the whole point is to filter inputs, not
  fork the projection.
- `chatSchema` / `chatListSchema` / any response shape in
  `packages/tavern-api` — clients depend on it.
- `listChats()` — the full-list path keeps its behavior; only `getChat`
  changes what it requests.
- Caching layers — explicitly rejected for now (sync/invalidation risk
  outweighs the win once the filter lands).

## Git workflow

- Conventional Commits, e.g. `perf: fetch a single chat's records in getChat`.
- Do NOT push unless the operator instructed it.

## Steps

### Step 1: Add a `chatId` filter to the two heavy storage reads

Locate `listRuntimeSessions` and `listRuntimeChatRecords` (grep above). Add an
optional `chatId` (sessions) / `id` (chat records) parameter that becomes a
SQL `WHERE` clause when present. Keep the no-filter behavior byte-identical.

**Verify**: `bun run --filter @tavern/server typecheck` → exit 0;
`cd apps/server && bun run test` → all pass (no behavior change yet).

### Step 2: Thread the filter through `listChatDetails`

Add `chatId?: string` to `listChatDetails` options and pass it to both heavy
reads. One subtlety: `archivedChatIds` is derived from the fetched
`chatRecords` — with a `chatId` filter the set degrades gracefully (it only
needs to know whether *this* chat is archived). Identity resolution and the
external-session id inference also only see this chat's rows, which is
exactly the data they need for a single-chat projection. Agents and
participants stay unfiltered.

Then change only `getChat`:

```ts
export async function getChat(input: { chatId: string }) {
    const chats = await listChatDetails({ chatId: input.chatId, includeExternal: false });
    const chat = chats.find((entry) => entry.id === input.chatId) ?? null;
    return chat ? chatSchema.parse(chat) : null;
}
```

(The `.find()` stays — the array now has length 0 or 1.)

**Verify**: `cd apps/server && bun run test` → all pass.

### Step 3: Prove parity with a test

In the existing chat-list test file, add a test that seeds ≥3 chats (mix of
archived/active, and an external-session chat if the harness supports it) and
asserts, for each id:
`await getChat({ chatId })` deep-equals the matching entry from
`await listChatDetails({ includeExternal: false })` projected through
`chatSchema`. This pins the filtered path to the full path.

Also add: `getChat` for an archived chat returns the same as before the
change (run the test against step-1 code mentally — the old behavior is
"archived chats are excluded from chatIds", so `getChat` on an archived chat
returns `null`; assert that explicitly).

**Verify**: `cd apps/server && bun run test` → all pass including the new
parity tests.

## Test plan

Covered in Step 3: parity test (filtered vs unfiltered projection for every
seeded chat), archived-chat returns `null`, unknown id returns `null`.
Model the harness on the existing chat tests in `apps/server/test/`.

## Done criteria

- [ ] `getChat` calls `listChatDetails` with a `chatId` filter; the two heavy
      storage reads accept and apply it
- [ ] Parity tests exist and pass
- [ ] `cd apps/server && bun run test` exits 0
- [ ] `bun run --filter @tavern/server typecheck` and `bun run lint` exit 0
- [ ] No response-shape change (`git diff packages/tavern-api` is empty)
- [ ] `plans/README.md` status row updated

## STOP conditions

- `listRuntimeSessions` / `listRuntimeChatRecords` turn out not to be local
  SQL reads (e.g. they call the runtime over HTTP) — the filter then belongs
  on the runtime API, which is a contract change this plan must not improvise.
- `buildRuntimeParticipantIdMap` or identity resolution turns out to need
  *other* chats' rows to resolve this chat correctly (the parity test in
  step 3 fails for external/multi-session chats) — report the failing case.
- The chat-list test file from "Current state" cannot be found — the test
  harness assumption is wrong; report what exists instead.

## Maintenance notes

- If chat pagination is ever added to `listChats`, the same input-filter
  pattern extends to it (limit/offset on `listRuntimeChatRecords`).
- Reviewer should scrutinize the parity test's seed data — it must include an
  archived chat and, if representable, an external-session chat, or the test
  proves less than it claims.
- Deferred: caching `listChatDetails` results (rejected for now), pagination,
  and the O(N) `.find()` in `listChats`'s consumers.
