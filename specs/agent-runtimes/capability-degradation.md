# Capability Degradation

Tavern treats runtime connectivity and runtime capability health as separate facts. A runtime can
be reachable while one capability is degraded, unavailable, unauthorized, or returning invalid data.
Tavern keeps synced records visible and attributes failures to the narrowest affected
capability.

This spec models capability failures through Tavern Runtime.

## Workstream

This is the first runtime reliability workstream. It should land before communication regression
testing because the regression suite needs stable degradation states to assert failures such as
`cronRuns` degraded, `models` unavailable, or `skills` unauthorized.

This work is a repeatable pattern across runtime-owned primitives and capability surfaces. The
implementation should establish the pattern once, then apply it capability by capability. Do not
build one-off status handling for each page.

## Goals

- Keep dashboard pages usable when OpenClaw is partially broken.
- Report which runtime capability failed instead of marking the whole runtime offline.
- Preserve existing records when a sync path fails.
- Make diagnostics and CI failures explain the affected runtime surface.
- Avoid inventing missing runtime ids, timestamps, schedules, actors, or records.

## Implementation Scope

The full implementation has three parts:

- a common capability status contract
- Runtime checks that record status for every capability Tavern depends on
- diagnostics and product reads that reference the stored status without blocking synced data

The first slice should still be small enough to land safely, but it should use the same Runtime
contracts, helpers, and API shape that the full implementation uses. A narrow slice is only a
delivery strategy, not a different design.

The best first slice is `status`, `models`, `skills`, and `cronRuns` because those surfaces prove
the important cases:

- runtime-wide reachability through `status`
- optional or unsupported surface through `models`
- user-visible config/list surface through `skills`
- paginated observed history through `cronRuns`

After that, the same pattern should be applied to `agents`, `chats`, `sessions`, `messages`,
`cron`, `events`, and `logs`.

## Deferred Scope

These items are intentionally not part of the first slice:

- channel, memory, or OpenClaw Doctor surfaces
- copyable rich diagnostic bundles
- page-specific warning banners
- CI communication regression runner
- pairing UX improvements

## Non-Goals

- Tavern App does not bundle, start, repair, or shell out to OpenClaw.
- Tavern App does not read OpenClaw runtime state, gateway logs, or OpenClaw config files directly.
- Tavern does not require every runtime to support every OpenClaw capability.
- Tavern does not hide malformed runtime responses behind compatibility fallbacks.

## Capability States

Capability state is reported per managed runtime namespace and per capability.

- `unknown`: Tavern has not checked this capability yet.
- `healthy`: the capability recently completed successfully.
- `degraded`: the capability is reachable but returned partial, malformed, slow, or inconsistent
  results.
- `unavailable`: the runtime does not expose this capability or the method is unsupported.
- `unauthorized`: credentials, pairing, or permissions are insufficient for this capability.

Tavern Runtime itself can be `reachable` while individual capabilities are not `healthy`.

## Capability Records

Each capability record includes:

- `capability`: stable capability id.
- `state`: one capability state.
- `checkedAt`: when Tavern last checked or observed this capability.
- `lastHealthyAt`: when the capability last completed successfully, or `null`.
- `reason`: short user-safe reason.
- `method`: runtime method or event stream that produced the state, when known.
- `errorCode`: stable adapter error code, when available.
- `technicalMessage`: concise technical message for diagnostics.

The app may show `reason`. Diagnostic copy/export may include `technicalMessage`.

## OpenClaw Capabilities

The OpenClaw adapter reports capability state for these surfaces:

| Capability | OpenClaw surface | Primary Tavern impact |
| --- | --- | --- |
| `status` | `health`, `status` | Tavern Runtime health |
| `tavernPlugin` | managed Tavern Messenger plugin install | Tavern-native chat delivery |
| `computerUse` | Codex Computer Use MCP app inventory | Computer Use app mentions |
| `agents` | `agents.list`, agent config/file methods | agents and agent settings |
| `chats` | `sessions.list`, chat target mapping | chats and bindings |
| `sessions` | `sessions.list`, `sessions.get` | session index and session detail |
| `messages` | `chat.history` | durable chat/session history |
| `cron` | `cron.list`, `cron.add`, `cron.update`, `cron.remove`, `cron.run` | cron job config and manual runs |
| `cronRuns` | `cron.runs` | cron run history |
| `skills` | `skills.status`, `skills.detail`, `skills.install` | skills list, preview, install |
| `skillMaterialization` | local OpenClaw workspace probe | per-agent skill workspace setup |
| `mentions` | `mention.list` | composer mention suggestions and metadata |
| `models` | `models.list` | model inventory |
| `memory` | memory verification | memory context |
| `events` | gateway websocket events | freshness and live status |
| `logs` | `logs.tail` when supported | runtime logs |

Future `channels` capabilities may be added when OpenClaw exposes stable gateway
surfaces that Tavern can consume without local filesystem access.

The first implementation slice covers `status`, `models`, `skills`, and `cronRuns`. The full table
defines the target shape so later slices can add coverage without changing the capability vocabulary
or storage model.

## Adapter Behavior

The OpenClaw adapter owns raw runtime error classification.

- Unsupported RPC methods map to `unavailable`.
- Auth, pairing, token, or permission failures map to `unauthorized`.
- Timeouts, malformed payloads, pagination defects, missing required ids, and invalid timestamps map
  to `degraded`.
- Transport-level failure that prevents even status checks updates Tavern Runtime health and
  may mark checked capabilities `unknown` until retried.
- Mapper failures include the affected capability and method.
- Mapper failures do not return fabricated Tavern records.

Adapter methods should return normal Tavern data on success. Capability state is exposed through a
dedicated status/diagnostic path rather than mixed into every list response.

The adapter should classify failures close to the gateway request or mapper that sees the failure.
It does not own long-term persistence. It returns data or throws typed failures with enough context
for the server to update capability status.

## Runtime And Server Behavior

Tavern Runtime stores capability state alongside Runtime health and primitive sync state.
The app backend reads this state through Runtime `/capabilities`; it does not run checks or store
Runtime capability health locally.

- A failed primitive sync updates that primitive's sync state only.
- A failed `cronRuns` sync does not mark `cron` job config as failed.
- A failed `messages` sync for one session does not delete previously synced messages.
- A failed `skills` read does not block agents, chats, or cron from syncing.
- Runtime edits still fail loudly when the capability needed for the edit is unavailable.
- Product reads continue to return existing records with freshness and error metadata.

## Runtime Storage

Tavern Runtime stores current capability status in a dedicated table instead of overloading
runtime-backed tables or `sync_state`.

Current related tables:

- `agent_runtime_connections` stores the Tavern Runtime endpoint plus coarse health fields such as
  `last_checked_at`, `last_error`, and `last_synced_at`.
- `sync_state` stores primitive sync freshness keyed by `kind` and `id`. It answers questions such
  as "did agent sync for this runtime succeed?" not "is the OpenClaw models capability available?"
- Runtime-backed tables such as `agents`, `chats`, `session_runs`, `session_messages`, `cron_jobs`, and
  `cron_runs` store runtime-owned records and row-level sync timestamps.

Runtime owns a table shaped like `runtime_capabilities`:

| Column | Purpose |
| --- | --- |
| `capability` | stable capability id such as `skills` or `cronRuns` |
| `state` | `unknown`, `healthy`, `degraded`, `unavailable`, or `unauthorized` |
| `checked_at` | latest check or observed failure time |
| `last_healthy_at` | latest successful check time |
| `reason` | short user-safe reason |
| `technical_message` | concise diagnostic message |
| `metadata_json` | optional structured diagnostic details |
| `updated_at` | row update timestamp |

Use `capability` as the primary key within the Runtime database. The table stores current status,
not an event log. Historical debugging uses Runtime job runs, server logs, or a later status
history table if needed.

Runtime diagnostics compose:

- one `agent_runtime_connections` row for the managed runtime namespace and coarse connection state
- all Runtime `/capabilities` rows for that runtime
- relevant `sync_state` rows for primitive freshness
- runtime-backed records and row `last_synced_at` values for product data

Product reads reference capability status only as context. They still return records first.
Mutations may fail immediately when the required capability is `unavailable` or `unauthorized`, but
list/detail reads should not blank existing synced data because a capability status is unhealthy.

## Event Invalidation

Capability status changes come from Runtime capability events. They do not reuse product data
events.

- Runtime capability changes refresh the runtime settings surface.
- Product data changes emit the owning domain event, such as `skill.onUpdate`, `agent.onUpdate`, or
  `cron.onUpdate`.

The runtime capability event must not invalidate product reads such as `skill.list`. A successful
capability check may happen while serving that same product read, so using the capability event to
refresh product data can create fetch loops.

## UI Behavior

The dashboard shows synced data first and capability degradation second.

- Runtime settings can show a capability table or diagnostic card.
- Product pages can show scoped warnings, such as "Cron run history is degraded."
- Empty runtime results remain valid empty states.
- Runtime-wide loading gates are not introduced for partial capability failures.
- Copyable diagnostics include runtime health, capability states, sync state, and recent
  adapter errors.

The first slice can use minimal visibility in runtime settings or diagnostics to prove the data
path. A polished dashboard view belongs to a later diagnostics workstream.

## Implementation Order

1. Define the capability ids, states, and record shape in the Runtime contract.
2. Add the Runtime `runtime_capabilities` table and storage helpers.
3. Add Runtime capability checks that convert dependency failures into typed capability failures.
4. Expose the stored state through Runtime `/capabilities`.
5. Wire the first slice: `status`, `models`, `skills`, and `cronRuns`.
6. Add Runtime, server client, and app rendering tests for the first slice.
7. Repeat the same pattern across the remaining capability table.
8. Add minimal app visibility only if the API path cannot otherwise be verified.

## Tests

Adapter tests cover:

- unsupported method -> `unavailable`
- auth or pairing failure -> `unauthorized`
- malformed list payload -> `degraded`
- missing required id/timestamp/schedule -> mapper failure with capability attribution
- `cron.runs` pagination errors -> `cronRuns` degradation

Server tests cover:

- one primitive sync failure does not poison unrelated primitives
- existing records remain after failed sync
- per-session message sync failures do not delete other session histories
- capability state is exposed in a stable API shape

Website or e2e tests cover:

- synced data remains visible when one capability degrades
- Tavern Runtime can be reachable while a capability warning is visible
- diagnostics copy includes capability state without exposing secrets

The first-slice test set is smaller:

- `models.list` unsupported -> `models: unavailable`
- `skills.status` unauthorized -> `skills: unauthorized`
- malformed `skills.status` payload -> `skills: degraded`
- broken `cron.runs` pagination -> `cronRuns: degraded`
- reachable runtime status with one degraded capability remains runtime `reachable`

## Acceptance Criteria

- Tavern can represent "OpenClaw reachable, skills unavailable."
- Tavern can represent "OpenClaw reachable, cron config healthy, cron run history degraded."
- Malformed OpenClaw payloads fail narrowly and do not create fake records.
- Runtime connection status, primitive sync state, and capability state are distinct.
- The diagnostics surface has enough structured data to explain which capability failed and why.

First-slice acceptance is narrower:

- `status`, `models`, `skills`, and `cronRuns` expose capability state.
- Unsupported, unauthorized, malformed, and timeout-like failures classify deterministically.
- The server can return a reachable runtime with a degraded or unavailable first-slice capability.
- Existing records are not deleted because a first-slice capability check fails.
