# Plan 003: Require a bearer token on Tavern Runtime HTTP and WebSocket APIs

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 0d1c19a2..HEAD -- apps/runtime/src/tavern/server.ts apps/runtime/src/config.ts apps/server/src/agent-runtime/client.ts apps/server/src/agent-runtime/drivers.ts apps/server/src/agent-runtime-connection/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M (closer to L if the WebSocket client inventory in step 1 finds surprises)
- **Risk**: MED — touches the app↔runtime transport; a missed client locks itself out
- **Depends on**: plans/001-ci-verification-gate.md (verification baseline)
- **Category**: security
- **Planned at**: commit `0d1c19a2`, 2026-06-10

## Why this matters

Tavern Runtime is designed to run on an always-on host and be reachable over
the network (`docs/operations/runtime-deploy.md` documents Mac mini + LAN /
Tailscale deployment). Its Trust Model section currently says, verbatim:
*"Runtime auth is not enabled yet. Expose the Runtime URL only on a trusted
network or behind operator-managed access control."* Meanwhile
`docs/api/auth.md` promises "Paired local transport with runtime credentials."
Today **every** runtime route — including engine install/restart, runtime
update, cron delivery, workspace files, and the event WebSockets — accepts any
request that reaches the port. Anyone on the same network as a deployed
runtime has full control of the agent engine.

The good news: the app side already has auth plumbing waiting to be used —
the connection store has an `auth_json` column, a parsed
`{ token?, password?, deviceToken? }` shape, an `authConfigured` flag, and the
ws driver interface even declares an unused `authJson` field. This plan
implements the runtime side (generate + enforce a token) and threads the token
through the existing app-side plumbing, the CLI, the dev stack, and e2e.

## Current state

### Runtime (enforcement target)

- `apps/runtime/src/tavern/server.ts` — `startTavernRuntimeServer()` creates
  the HTTP server and the ws upgrade handler. HTTP requests flow directly into
  `handleTavernRuntimeRequest(fetchRequest)` with no auth. The upgrade handler
  checks only the path:

  ```ts
  server.on('upgrade', (request, socket: Duplex, head) => {
      if (!(isEventsSocketPath(request.url) || isTavernApiEventsSocketPath(request.url) || isTavernChannelSocketPath(request.url))) {
          socket.destroy();
          return;
      }
      wss.handleUpgrade(request, socket, head, ...);
  });
  ```

- `apps/runtime/src/tavern/router.ts` — `handleTavernRuntimeRequest` is the
  single HTTP dispatch for all runtime routes (chat API, cortex, jobs,
  model-access, workspace, engine proxy, update/restart).
- `apps/runtime/src/config.ts:90-113` — existing pattern for a generated
  persisted token (the Hermes dashboard session token). Follow it exactly:
  env override → read token file → generate `randomBytes(32).toString('base64url')`,
  write with mode `0o600`:

  ```ts
  const token = randomBytes(32).toString('base64url');
  fs.mkdirSync(path.dirname(tokenPath), { recursive: true });
  fs.writeFileSync(tokenPath, `${token}\n`, { mode: 0o600 });
  ```

- `apps/runtime/src/tavern/http.ts` — has helpers like `forbidden`, `json`.
  Check whether an `unauthorized` (401) helper exists; add one beside
  `forbidden` if not.
- `apps/runtime/src/tavern/server.test.ts` exists — extend it for 401/403
  behavior.
- The runtime health route is defined in `@tavern/api` `runtimeRoutes` (used
  in router.ts); health stays **unauthenticated** so the app can probe
  reachability before pairing.

### App server (client side)

- `apps/server/src/agent-runtime/client.ts` (~1535 LoC) —
  `HttpTavernAgentRuntimeClient`, constructor takes
  `{ baseUrl }` via `agentRuntimeClientOptionsSchema`. Roughly 30 raw
  `fetch(...)` call sites, each building its own `headers`. Excerpt:

  ```ts
  class HttpTavernAgentRuntimeClient implements TavernAgentRuntimeClient {
      readonly #baseUrl: string;
      constructor(options: AgentRuntimeClientOptions) {
          const parsed = agentRuntimeClientOptionsSchema.parse(options);
          this.#baseUrl = trimTrailingSlash(parsed.baseUrl);
      }
  ```

- `apps/server/src/agent-runtime/drivers.ts` — already declares the field but
  ignores it:

  ```ts
  export interface AgentRuntimeDriverConnection {
      authJson?: null | string;
      baseUrl: string;
  }
  export function createAgentRuntimeClientForConnection(input: AgentRuntimeDriverConnection): TavernAgentRuntimeClient {
      return createAgentRuntimeClient(input.baseUrl);   // authJson dropped here
  }
  export async function subscribeAgentRuntimeEventsForConnection(input, observer) {
      const socket = new WebSocket(toWebSocketUrl(input.baseUrl, agentRuntimeRoutes.events));  // no headers
  ```

  Note: this `WebSocket` is the `ws` package (Node), which accepts
  `new WebSocket(url, { headers: { authorization: ... } })`.

- `apps/server/src/agent-runtime-connection/auth.ts` —
  `parseAgentRuntimeConnectionAuth` already parses `auth_json` into
  `{ token?, password?, deviceToken? }` (schema at
  `apps/server/src/agent-runtime-connection/contracts.ts:37-43`).
- `apps/server/src/agent-runtime-connection/service.ts:151` — already exposes
  `authConfigured` on connection records.
- `apps/server/src/agent-runtime-connection/environment-override.ts` — builds
  the env-var-driven connection (reads `TAVERN_RUNTIME_URL` via service.ts);
  this is where a `TAVERN_RUNTIME_TOKEN` env var should populate `auth`.

### Everything else that talks to the runtime

- CLI: `apps/runtime/src/cli/runtime-probe.ts` and
  `apps/runtime/src/cli/commands/cortex.ts` use `fetch` against the local
  runtime. The CLI runs on the runtime host, so it can read the token file
  from disk directly.
- Dev stack: `scripts/run-dev-stack.mjs` generates per-worktree env for both
  runtime and server.
- E2E: `apps/website/e2e/start-tavern-runtime.ts` starts a runtime for
  Playwright; `apps/website/e2e/start-tavern-server.ts` starts the server.
- `.env.example` documents `TAVERN_RUNTIME_*` vars.
- Docs to update: `docs/operations/runtime-deploy.md` (Trust Model section,
  line ~179), `docs/api/auth.md`, `docs/api/admin.md` if it states auth
  behavior.

## Commands you will need

| Purpose   | Command                                      | Expected on success |
|-----------|----------------------------------------------|---------------------|
| Install   | `bun install --frozen-lockfile`              | exit 0              |
| Runtime tests | `cd apps/runtime && bun run test`        | all pass            |
| Server tests  | `cd apps/server && bun run test`         | all pass            |
| Typecheck | `bun run typecheck`                          | exit 0              |
| Lint      | `bun run lint`                               | exit 0              |
| Runtime build | `bun run --filter @tavern/runtime build` | exit 0              |
| Dev stack smoke | `bun run dev:web:runtime` (manual, then Ctrl-C) | server connects to runtime; no 401 loops in logs |
| E2E       | `bun run test:e2e`                           | all pass            |

## Scope

**In scope**:
- `apps/runtime/src/config.ts` (token resolution: `TAVERN_RUNTIME_TOKEN` env →
  `<runtime root>/runtime-api-token` file → generate)
- `apps/runtime/src/tavern/server.ts` (HTTP + ws upgrade enforcement)
- `apps/runtime/src/tavern/http.ts` (401 helper if missing)
- `apps/runtime/src/tavern/server.test.ts` (tests)
- `apps/runtime/src/cli/**` (CLI reads token from disk; only the files that fetch)
- `apps/server/src/agent-runtime/client.ts` + its options schema (send bearer)
- `apps/server/src/agent-runtime/drivers.ts` (use `authJson` for client + ws headers)
- `apps/server/src/agent-runtime-connection/environment-override.ts` and
  `service.ts` (populate auth from `TAVERN_RUNTIME_TOKEN`)
- `scripts/run-dev-stack.mjs`, `apps/website/e2e/start-tavern-runtime.ts`,
  `apps/website/e2e/start-tavern-server.ts` (thread a fixed dev/e2e token)
- `.env.example`, `docs/operations/runtime-deploy.md`, `docs/api/auth.md`
- `packages/tavern-api` — only if a shared header-name constant belongs there
  (there is precedent: `agentRuntimeMutationHeaders` in
  `packages/tavern-api/src/runtime/routes.ts`)

**Out of scope** (do NOT touch):
- Hermes Gateway credentials, the Hermes dashboard session token, and
  `apps/runtime/src/hermes/**` — separate trust boundary, already
  credentialed.
- The app's tRPC server auth (`apps/server` HTTP surface to the Electron app)
  — different boundary, governed by `origin.ts`.
- Password/deviceToken auth modes in the connection schema — token only; the
  other fields stay dormant.
- Any UI work beyond what already exists for `authConfigured` — if the
  settings UI lacks a token input, note it in the README as follow-up rather
  than building UI in this plan.

## Git workflow

- Conventional Commits, e.g. `feat: require bearer token on runtime HTTP and ws APIs`.
- Commit in two groups: runtime-side enforcement + tests, then app/CLI/dev
  threading + docs.
- Do NOT push unless the operator instructed it.

## Steps

### Step 1: Inventory every client of the runtime port

Before changing anything, list every code path that connects to the runtime
HTTP server or its WebSockets:

```
grep -rn "TAVERN_RUNTIME_URL\|toWebSocketUrl\|agentRuntimeRoutes.events\|/api/events/ws\|channel" apps/server/src apps/runtime/src/cli apps/website/e2e scripts | grep -v test | grep -vi hermes
```

Expected clients: server HTTP client (client.ts), server ws driver
(drivers.ts), CLI fetches, e2e harness, dev-stack probes. **Pay special
attention to the Tavern *channel* socket** (`isTavernChannelSocketPath` in
server.ts → `attachTavernChannelSocket`): find who connects to it
(`grep -rn "channel" apps/runtime/src/tavern/channel*` and check whether the
managed Hermes process or a relay connects). If the channel client is the
managed Hermes engine or any process you cannot pass a header through, STOP
and report the inventory — the plan needs a decision on that socket.

**Verify**: written inventory in your report; every client has a token path.

### Step 2: Token resolution on the runtime

In `apps/runtime/src/config.ts`, add `getRuntimeApiToken()` following the
dashboard-session-token pattern at lines 90–113: `TAVERN_RUNTIME_TOKEN` env
override → read `<runtime root>/runtime-api-token` → generate
base64url(32 bytes), persist mode 0600. (Find the runtime root helper in the
same file — config.ts already resolves it for other state.)

**Verify**: `bun run --filter @tavern/runtime typecheck` → exit 0.

### Step 3: Enforce on HTTP and ws upgrade

In `server.ts`:

- HTTP: before dispatching to `handleTavernRuntimeRequest`, allow the health
  route (`runtimeRoutes.health` — confirm exact path in
  `packages/tavern-api/src/runtime/routes.ts`) unauthenticated; for everything
  else require `authorization: Bearer <token>` (constant-time compare via
  `crypto.timingSafeEqual` on hashed/equal-length buffers). Reject with 401.
- ws upgrade: same check on the upgrade request headers. The `ws` client can
  send headers; reject by writing `HTTP/1.1 401 Unauthorized\r\n\r\n` to the
  socket and destroying it. Do NOT add a `?token=` query-param fallback — all
  known ws clients are Node-side and can send headers (step 1 verified this).

**Verify**: `cd apps/runtime && bun run test` → existing server.test.ts tests
updated and passing (they will initially fail with 401 — update them to send
the token; that failure is itself proof of enforcement).

### Step 4: Thread the token through the app server

- `client.ts`: extend `agentRuntimeClientOptionsSchema` with optional
  `token`; store `#headers` once; add the authorization header to every
  `fetch` site (mechanical — `headers: { ...this.#authHeaders, ... }`).
- `drivers.ts`: parse `input.authJson` with `parseAgentRuntimeConnectionAuth`
  (import from `../agent-runtime-connection/auth.ts`), pass `token` into
  `createAgentRuntimeClient`, and pass
  `{ headers: { authorization: 'Bearer ...' } }` to `new WebSocket(...)`.
- `environment-override.ts` / `service.ts`: when `TAVERN_RUNTIME_URL` is used,
  also read `TAVERN_RUNTIME_TOKEN` into the connection `auth`.

**Verify**: `cd apps/server && bun run test` → all pass.
`grep -c "authorization" apps/server/src/agent-runtime/client.ts` → ≥ number
of fetch sites touching the runtime (spot-check none missed:
`grep -n "fetch(" apps/server/src/agent-runtime/client.ts | wc -l`).

### Step 5: CLI, dev stack, e2e

- CLI fetch sites read the token file from disk (same host) — reuse
  `getRuntimeApiToken()`; do not generate on read-only commands if the file is
  missing (fall back to unauthenticated request + clear error on 401 telling
  the operator the runtime requires a token).
- `scripts/run-dev-stack.mjs`: generate a per-worktree token once and export
  `TAVERN_RUNTIME_TOKEN` to BOTH the runtime and server processes.
- e2e: set a fixed token (e.g. `e2e-runtime-token`) in both
  `start-tavern-runtime.ts` and `start-tavern-server.ts` envs.

**Verify**: `bun run dev:web:runtime` boots; server logs show runtime
connected (no 401 loop); then `bun run test:e2e` → all pass.

### Step 6: Docs and env example

- `docs/operations/runtime-deploy.md` Trust Model: replace "Runtime auth is
  not enabled yet" with the token model: where the token lives on the host,
  the `TAVERN_RUNTIME_TOKEN` override, and how the app supplies it.
- `docs/api/auth.md`: runtime credentials row now reflects reality.
- `.env.example`: add `# TAVERN_RUNTIME_TOKEN=` with one comment line.

**Verify**: `bun run docs:list` still lists both docs; `bun run lint` exit 0.

## Test plan

- `apps/runtime/src/tavern/server.test.ts` (extend, following its existing
  start-server-on-a-port pattern):
  - request without token → 401; with wrong token → 401; with token → 200.
  - health route without token → 200.
  - ws upgrade without token → connection fails; with token header → events
    flow (reuse however the file currently exercises sockets).
- `apps/server`: extend `apps/server/test/agent-runtime-event-sync.test.ts`
  or `agent-runtime-client.test.ts` minimally — assert the client sends the
  authorization header when constructed with a token (the test infra already
  fakes runtime endpoints; assert on the received request, not on a spy).
- Full suites: `cd apps/runtime && bun run test`, `cd apps/server && bun run test`.

## Done criteria

- [ ] Any non-health runtime HTTP request without a valid bearer token gets 401
      (proven by tests)
- [ ] ws upgrades without the token are rejected (proven by test)
- [ ] `cd apps/runtime && bun run test` and `cd apps/server && bun run test` exit 0
- [ ] `bun run typecheck` and `bun run lint` exit 0
- [ ] `bun run test:e2e` exits 0
- [ ] `grep -n "not enabled yet" docs/operations/runtime-deploy.md` → no matches
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- Step 1 finds a runtime-socket client that cannot send a header (e.g. the
  channel socket is dialed by the managed Hermes engine with no env you can
  set) — report the inventory and stop.
- The settings/connection UI turns out to *require* changes for the app to
  store a token against the default local connection (i.e. the environment
  override path is not how the desktop app connects in production) — report
  what the production pairing path is and stop.
- E2E fails with 401s after step 5 and one targeted fix attempt — the e2e
  harness wiring differs from this plan's read of it.

## Maintenance notes

- Future external clients (SDK users, `docs/api/auth.md`'s "explicit
  Tavern-issued credentials") should reuse this same bearer check — keep the
  header name in one shared constant (precedent:
  `agentRuntimeMutationHeaders` in `packages/tavern-api`).
- Reviewer should scrutinize: constant-time comparison, the health-route
  exemption list staying minimal, and that no fetch site in client.ts was
  missed (a missed one fails only at runtime on that feature).
- Deferred: token rotation, a pairing UX in settings (token paste field), and
  TLS — network encryption remains the operator's concern (Tailscale), as
  documented.
