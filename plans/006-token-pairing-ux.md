# Plan 006: Token pairing UX — `tavern token` CLI command + token fields in onboarding and settings

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on.
> Touch only the files listed as in scope. If any STOP condition occurs,
> stop and report — do not improvise. Your reviewer maintains
> `plans/README.md`; do not edit it.
>
> **Branch setup (run first — this plan builds on unmerged work)**: the code
> this plan extends lives on the pushed branch
> `claude/nostalgic-lehmann-3c3411`, NOT on main. In your worktree run:
> `git fetch origin && git switch -c plan-006 15513440`
> (commit `15513440` is the tip of that pushed branch at planning time).
> Then drift check: `git diff --stat 15513440..HEAD` → must be empty. Any
> difference is a STOP condition.

## Status

- **Priority**: P1 (unblocks merging runtime auth for desktop-app installs)
- **Effort**: M
- **Risk**: MED — touches the connection-save path; the known trap is wiping
  a stored token on URL-only saves
- **Depends on**: plan 003 (DONE — on the branch above)
- **Category**: dx / security
- **Planned at**: commit `15513440`, 2026-06-11

## Why this matters

Plan 003 made Tavern Runtime require a bearer token, but the only ways to
give the app the token are the `TAVERN_RUNTIME_TOKEN` env var or the API.
The product flow the operator wants: run a CLI command on the runtime host
that prints the token, then paste it into the Tavern app — in the same two
places the runtime URL is entered today (onboarding, and Settings → Tavern
Runtime). The backend contract already accepts it end-to-end
(`agentRuntimeConnectionInputSchema.auth.token` → `saveAgentRuntimeConnection`
→ `auth_json` column); only the CLI command and the two UI forms are missing,
plus one server-side save bug that would wipe stored tokens.

## Current state

(All paths relative to repo root; verified at `15513440`.)

### Runtime CLI (registry-driven)

- `apps/runtime/src/cli/registry.ts` — `CliCommand` interface and the command
  list. Exemplar entry:

  ```ts
  const statusCommand: CliCommand = {
      name: 'status',
      ...
      usage: 'tavern status [--json] [--runtime-url <url>]',
      ...
      examples: ['tavern status', 'tavern status --json'],
  ```

- `apps/runtime/src/cli/commands/` — per-command modules (`status.ts`,
  `engine.ts`, `cortex.ts`) each with a sibling `.test.ts`. Follow
  `status.ts` + `status-render.ts` + `status.test.ts` as the structural
  pattern (command logic separate from rendering, tests on both).
- `apps/runtime/src/config.ts` — `getRuntimeApiToken()` (added by plan 003):
  resolves `TAVERN_RUNTIME_TOKEN` env → `<runtime root>/runtime-api-token`
  file → generates and persists (mode 0600). The CLI runs on the runtime
  host, so calling this is the correct way to read/create the token.

### App server (save path — contains the trap)

- `apps/server/src/api/agent-runtime/connect.ts` — tRPC mutation, takes
  `agentRuntimeConnectionInputSchema` (which already includes
  `auth: { token?, password?, deviceToken? } | undefined`) and passes
  `auth: input.auth` to `saveAgentRuntimeConnection`.
- `apps/server/src/agent-runtime-connection/service.ts` (~line 454):

  ```ts
  authJson: auth ? JSON.stringify(auth) : null,
  ```

  **The trap**: a URL-only save (auth undefined) NULLs the stored token.
  Plan 003 fixed this exact bug class for the environment-override store
  (`apps/server/src/agent-runtime-connection/environment-override.ts:38-45`
  — preserve on `undefined`, clear only on explicit `null`); the saved-
  connection path needs the same semantics. There is a regression-test
  pattern to copy: `apps/server/test/agent-runtime-auth-regression.test.ts`.

### Website (two forms, one hook)

- `apps/website/src/features/settings/agent-runtime/agent-runtime-panel.tsx`
  — settings form; `const [baseUrl, setBaseUrl] = React.useState(...)`, saves
  via `connectMutation.mutate({ baseUrl: trimmedBaseUrl })` (line ~98). Has a
  `connection.source === 'environment'` disabled state — keep it (env-
  configured connections are not editable here). `connection.authConfigured`
  is already available on the record.
- `apps/website/src/features/onboarding/onboarding-page.tsx` — onboarding
  runtime step; `const [baseUrl, setBaseUrl] = React.useState(connection?.baseUrl ?? '')`
  (line ~108), with `runtimeUrlInputId` / error-id wiring. Match its input
  markup for the token field.
- `apps/website/src/hooks/connections/use-connect-agent-runtime.ts` — the
  mutation hook both forms use.
- UI copy rules (repo): never name "Hermes"; plain product language; match
  the existing input components used in these two files (COSS/Base UI — do
  not introduce new component libraries). Helper text should reference the
  CLI command, e.g. "Run `tavern token` on the runtime host to get this."

### 401 surfacing (already half-built)

- `apps/server/src/agent-runtime/capability-status.ts` —
  `classifyCapabilityFailure` already maps 401 to an `unauthorized` state.
  Connect errors reach the forms via `connectMutation.error`. Improving copy
  when the failure is an auth failure is in scope; reworking error plumbing
  is not.

## Commands you will need

| Purpose   | Command                                  | Expected on success |
|-----------|------------------------------------------|---------------------|
| Install   | `bun install --frozen-lockfile`          | exit 0              |
| Runtime tests | `cd apps/runtime && bun run test`    | all pass            |
| Server tests  | `cd apps/server && bun run test`     | all pass            |
| Website typecheck | `bun run --filter @tavern/website typecheck` | exit 0   |
| Full typecheck | `bun run typecheck`                 | exit 0              |
| Lint      | `bun run lint`                           | no NEW errors       |

Known pre-existing failures you are NOT responsible for: 9 e2e tests
(documented in `plans/README.md`) and 2 lint format errors in
`apps/runtime/src/hermes/supervisor.test.ts`.

## Scope

**In scope**:
- `apps/runtime/src/cli/commands/token.ts` (new) + `token.test.ts` (new)
- `apps/runtime/src/cli/registry.ts` (register the command)
- `apps/server/src/agent-runtime-connection/service.ts` (preserve-on-undefined
  auth semantics for saved connections; the storage helper it calls in
  `apps/server/src/storage/agent-runtime-connections.ts` if the fix belongs
  there)
- `apps/server/test/agent-runtime-auth-regression.test.ts` (extend)
- `apps/website/src/features/settings/agent-runtime/agent-runtime-panel.tsx`
- `apps/website/src/features/onboarding/onboarding-page.tsx`
- `apps/website/src/hooks/connections/use-connect-agent-runtime.ts`
- `docs/operations/runtime-deploy.md` (pairing recipe: `tavern token` → paste
  into app) and `docs/api/auth.md` if it describes pairing

**Out of scope** (do NOT touch):
- `packages/tavern-api` — the contract already carries `auth`; no changes.
- Token rotation, QR pairing, multi-token support.
- `apps/runtime/src/tavern/server.ts` enforcement — done in plan 003.
- The environment-override store — already has correct semantics.
- Any new component library or design tokens; reuse what the two forms use.

## Git workflow

- Conventional Commits. Two commits: (1) CLI command + docs,
  (2) server save semantics + UI fields + tests.
- Do NOT push.

## Steps

### Step 1: `tavern token` CLI command

Create `commands/token.ts` following the `status.ts` pattern: command prints
the runtime API token from `getRuntimeApiToken()` to stdout. Plain output is
the token itself (script-friendly, one line); add a `--json` flag printing
`{ "token": "..." }` for symmetry with `status --json`. Help text: one line
("Print the Runtime API token for pairing the Tavern app") plus a hint in
`examples`. Register in `registry.ts`. Test (`token.test.ts`, modeled on
`status.test.ts`): command prints the token from a temp runtime root, exit 0,
`--json` shape parses; running it twice prints the same token (file persisted).

**Verify**: `cd apps/runtime && bun run test` → all pass including new tests.

### Step 2: Fix the saved-connection auth-wipe trap

In the saved-connection write path (`service.ts` `saveAgentRuntimeConnection`
and/or the storage helper): `auth === undefined` preserves the existing
stored `authJson`; explicit `auth: null` (or an empty object per the existing
`parseAgentRuntimeConnectionAuth` semantics) clears it. Mirror the
implementation and comment style of the environment-override fix at
`environment-override.ts:38-45`. Extend
`agent-runtime-auth-regression.test.ts` with: save URL+token, then save
URL-only → token still present; save with explicit clear → token gone.

**Verify**: `cd apps/server && bun run test` → all pass including the new cases.

### Step 3: Token fields in the two forms

In BOTH `agent-runtime-panel.tsx` and `onboarding-page.tsx`:

- Add an optional token input below the runtime URL field, using the same
  input component/markup as the URL field, `type="password"`-style masking if
  the existing components support it (do not build a custom reveal toggle).
- Label: "Runtime token". Helper text: `Run \`tavern token\` on the runtime
  host to get this.` In the settings panel, when `connection.authConfigured`
  is true and the field is empty, show placeholder "Configured" (or the
  panel's existing convention for set-but-hidden values).
- Submit: include `auth: { token: trimmedToken }` ONLY when the user entered
  a non-empty value; omit `auth` entirely otherwise (step 2 makes omission
  safe). Thread the field through `use-connect-agent-runtime.ts` input types.
- Error copy: when `connectMutation.error` indicates an unauthorized/401
  failure, show "The runtime requires a token. Run `tavern token` on the
  runtime host and paste it here." (string-match on the error state the
  server returns — inspect what the connect failure actually carries before
  writing the condition; if the error gives you no way to distinguish 401,
  note it in your report and skip this bullet rather than guessing).

**Verify**: `bun run --filter @tavern/website typecheck` → exit 0; then full
`bun run typecheck` → exit 0.

### Step 4: Docs

`docs/operations/runtime-deploy.md`: in the Trust Model / pairing section,
document the flow — deploy runtime → `tavern token` on the host → paste into
Tavern app (Settings → Tavern Runtime, or during onboarding). Update
`docs/api/auth.md` only if it describes the pairing flow. Keep copy short;
no engine naming.

**Verify**: `bun run docs:list` exits 0 and still lists both docs;
`bun run lint` → no new errors.

## Test plan

- CLI: `token.test.ts` (step 1) — print, persistence, `--json`.
- Server: regression cases (step 2) — preserve-on-undefined, explicit clear.
- UI: if `agent-runtime-panel` or `onboarding` have existing component tests
  (check `apps/website/src/features/**/*.test.ts*`), extend the nearest one;
  if none exist for these files, do not invent a new UI test harness — note
  it and rely on typecheck.
- Full suites: `cd apps/runtime && bun run test`, `cd apps/server && bun run test`.

## Done criteria

- [ ] `tavern token` is in the generated CLI help and prints the same token
      the runtime enforces (proven by CLI test using a temp runtime root)
- [ ] URL-only re-save no longer wipes a stored token (proven by server test)
- [ ] Both forms can submit a token; omitted token leaves stored auth intact
- [ ] `cd apps/runtime && bun run test` and `cd apps/server && bun run test` exit 0
- [ ] `bun run typecheck` exits 0; `bun run lint` adds no new errors
- [ ] No files outside the in-scope list modified (`git status`)

## STOP conditions

- The branch setup drift check fails (you are not at `15513440`).
- `connectMutation.error` exposes no usable signal to distinguish an auth
  failure AND implementing it would require changing the connect procedure's
  error shape — skip the error-copy bullet and report, per step 3.
- The settings panel's `source === 'environment'` handling conflicts with
  adding a token field in a way the existing disabled-state doesn't already
  cover — report rather than redesigning the panel.
- Adding the command requires changes to the registry/help framework itself
  (it should not — status/engine/cortex prove the pattern).

## Maintenance notes

- Token rotation: when added, `tavern token --rotate` belongs in this same
  command; the UI field already supports re-pasting.
- Reviewer should scrutinize: the omit-vs-clear semantics in step 2 (the
  exact bug class that broke e2e in plan 003), and that the token never
  renders back into the DOM after save in either form.
- Deferred: pairing UX beyond paste (QR/deep link), per-client tokens,
  SDK realtime-websocket auth for external clients.
