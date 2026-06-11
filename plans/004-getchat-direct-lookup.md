# Plan 004: Stop building every chat to serve one — single-chat lookup path

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 0d1c19a2..HEAD -- apps/server/src/chat/list.ts apps/server/src/chat/runtime-chats.ts apps/server/src/sessions/runtime-sessions.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED — the single-chat fetch must produce a record identical to
  what the paginated list walk produces for that chat; the parity test is the
  load-bearing safety net
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `0d1c19a2`, 2026-06-10 (rewritten same day after a
  first executor run STOPPED: the original plan assumed the heavy reads were
  local SQL — they are HTTP calls to the runtime; this version routes the
  single-chat case through the runtime API's existing single-chat endpoint)

## Why this matters

`getChat` — the procedure behind opening a single chat — calls
`listChatDetails()`, which fetches **all** agents, **all** participants,
**all** runtime sessions, and **all** runtime chat records (a *paginated HTTP
walk over every chat in the runtime*), projects every chat into its
presentation shape, then does a linear `.find()` for the one requested id.
Every chat open pays for the whole library, and `getChat` re-runs on realtime
invalidations. The biggest cost is the paginated `chat.list` walk. The
runtime API already exposes a single-chat read — `client.chat.get(chatId)`,
already used elsewhere in the same file — so the fix is to let
`listRuntimeChatRecords` take an optional `chatId` and fetch exactly one
record through the existing endpoint, leaving the projection logic untouched.

Honest scope note: `listRuntimeSessions()` has **no** chatId filter on its
runtime API, so the sessions fetch stays whole. This plan removes the
dominant cost (the all-chats walk), not every cost.

## Current state

(Verified by a prior executor run on this exact code, 2026-06-10.)

- `apps/server/src/chat/list.ts` — the chat list/projection module.
  Entry points (lines 188–203):

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

- `apps/server/src/chat/runtime-chats.ts:30-71` — `listRuntimeChatRecords`
  creates a Tavern SDK client (`createTavernClient({ baseUrl: connection.baseUrl })`)
  and iterates pages via `client.chat.list(...)` (HTTP). This is the heavy
  walk.
- `apps/server/src/chat/runtime-chats.ts:301-309` — `getTavernChatOrNull`
  already fetches ONE chat via `client.chat.get(chatId)`. This is the
  endpoint and error-handling pattern to reuse.
- `apps/server/src/sessions/runtime-sessions.ts:8-20` — `listRuntimeSessions`
  calls `client.listSessions()` (HTTP), **no chat filter available**. Leave
  it alone.
- `agents` and `participants` are small reference reads used as lookup maps —
  leave them whole.
- Tests: server tests are `bun:test`, run via `cd apps/server && bun run test`
  (a per-file runner). Find the chat-list test file with
  `grep -rln "listChatDetails\|getChat" apps/server/test` and model new tests
  on it (the harness style is visible in
  `apps/server/test/agent-runtime-event-sync.test.ts`).

## Commands you will need

| Purpose   | Command                                  | Expected on success |
|-----------|------------------------------------------|---------------------|
| Install   | `bun install --frozen-lockfile`          | exit 0              |
| Server tests | `cd apps/server && bun run test`      | all pass            |
| One file  | `cd apps/server && bun test test/<file>.test.ts` | pass        |
| Typecheck | `bun run --filter @tavern/server typecheck` | exit 0           |
| Lint      | `bun run lint` (pre-existing failure in `apps/runtime/src/hermes/supervisor.test.ts` is known; you must add no NEW errors) | no new errors |

## Scope

**In scope**:
- `apps/server/src/chat/list.ts` (thread `chatId` option; change `getChat` only)
- `apps/server/src/chat/runtime-chats.ts` (optional `chatId` on
  `listRuntimeChatRecords` → single fetch via `client.chat.get`)
- The existing chat-list test file in `apps/server/test/` (extend)

**Out of scope** (do NOT touch):
- `apps/server/src/sessions/runtime-sessions.ts` — no filter exists on its
  API; do not invent one.
- The projection logic inside `listChatDetails` (identity resolution,
  archived filtering, participant mapping, presentation helpers).
- `chatSchema` / `chatListSchema` / anything in `packages/tavern-api` — no
  contract changes in this plan.
- `listChats()` and `getTavernChatOrNull` behavior.
- Caching layers.

## Git workflow

- Conventional Commits, e.g. `perf: fetch a single chat record in getChat`.
- Do NOT push.

## Steps

### Step 1: Optional `chatId` on `listRuntimeChatRecords`

In `runtime-chats.ts`, add `chatId?: string` to the options of
`listRuntimeChatRecords`. When present:

- fetch via `client.chat.get(chatId)` using the same client construction and
  error handling as `getTavernChatOrNull` (lines 301–309) — in particular,
  a missing/404 chat yields an empty record list, not a throw;
- map the single chat through the **same** record-shaping code the list path
  uses (extract a shared helper if the mapping is currently inline in the
  pagination loop — moving that mapping into a function both paths call is in
  scope; duplicating it is not);
- apply the same `includeArchived` / `includeExternal` semantics the list
  path applies at fetch time, if any (read the list path carefully; if those
  options only matter downstream in `list.ts`, nothing extra is needed here).

When `chatId` is absent, behavior must be byte-identical to today.

**Verify**: `bun run --filter @tavern/server typecheck` → exit 0;
`cd apps/server && bun run test` → all pass (no caller changed yet).

### Step 2: Thread `chatId` through `listChatDetails` into `getChat`

Add `chatId?: string` to `listChatDetails` options, passed only to
`listRuntimeChatRecords`. Sessions, agents, participants are fetched as
before. Then change only `getChat`:

```ts
export async function getChat(input: { chatId: string }) {
    const chats = await listChatDetails({ chatId: input.chatId, includeExternal: false });
    const chat = chats.find((entry) => entry.id === input.chatId) ?? null;
    return chat ? chatSchema.parse(chat) : null;
}
```

(The `.find()` stays — with the filter the array is small, and when
`includeExternal` inference adds session-derived ids the requested chat may
not be the only entry.)

**Verify**: `cd apps/server && bun run test` → all pass.

### Step 3: Prove parity with a test

In the existing chat-list test file, seed ≥3 chats (mix archived/active; an
external-session chat if the harness supports it) and assert, for each id:
`await getChat({ chatId })` deep-equals the corresponding entry from the
unfiltered `listChatDetails({ includeExternal: false })` parsed through
`chatSchema`. Also assert: `getChat` on an archived chat → `null` (archived
chats are excluded from chatIds today); unknown id → `null` (and does not
throw, even though `client.chat.get` may 404).

**Verify**: `cd apps/server && bun run test` → all pass including new tests.

## Test plan

Covered in Step 3: per-chat parity (filtered vs unfiltered projection),
archived → `null`, unknown id → `null` without throwing. Model on the
existing chat tests in `apps/server/test/`.

## Done criteria

- [ ] `getChat` passes `chatId` through `listChatDetails` to
      `listRuntimeChatRecords`, which uses `client.chat.get` for the single case
- [ ] No paginated `chat.list` walk happens on the `getChat` path (verify by
      reading the code path, and state it in your report)
- [ ] Parity tests exist and pass
- [ ] `cd apps/server && bun run test` exits 0
- [ ] `bun run --filter @tavern/server typecheck` exits 0; lint adds no new errors
- [ ] `git diff packages/tavern-api` is empty
- [ ] No files outside the in-scope list modified (`git status`)

## STOP conditions

- Baseline server suite fails before any edits.
- `client.chat.get` returns a chat shape missing fields the list-path record
  mapping needs (e.g. participants/bindings present in list but not get) —
  report the exact field difference; the parity test failing for this reason
  is the same STOP.
- The record mapping in the pagination loop cannot be extracted without
  changing list behavior (e.g. it depends on pagination state) — report.
- The chat-list test file cannot be found — report what exists instead.

## Maintenance notes

- If the runtime API ever grows a `sessions.list(chatId)` filter, the
  remaining whole-fetch in `listRuntimeSessions` should adopt it — that's the
  rest of the win this plan leaves on the table.
- Reviewer should scrutinize: the shared mapping helper (no drift between
  single and list paths) and the 404 → `null` behavior.
- Deferred: pagination for `listChats`, caching, sessions filter (above).
