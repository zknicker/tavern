---
summary: Runtime-owned capability health; the singular feature-gating contract between Tavern App and Tavern Runtime.
read_when:
  - changing Runtime capability checks, capability storage, or capability APIs
  - changing job enablement that depends on Runtime readiness
  - gating Tavern App features on Runtime or managed Hermes readiness
  - changing chat send, runtime sync, skills, models, mentions, jobs, or Hermes-backed app behavior
  - changing the Tavern Runtime settings capability table
---

# Runtime Capabilities

Runtime capabilities are health records for Runtime-owned services and
dependencies. Runtime owns the checks, stores the results, exposes them through
the Admin API, and makes them available to other product surfaces.

Capabilities are a readiness primitive. Jobs, micro-features, and whole app
pages can use capability health to decide whether a feature is available,
degraded, or blocked.

Capabilities are not quality scores. Domain freshness, content quality, missing
wiki topics, and broken wiki links belong to domain status APIs or future Tasks
workflows, not Runtime capability health.

The app only renders capability state. It does not decide whether a Runtime
capability is healthy.

## App Rule

Runtime capabilities are the app's singular readiness interface.

If an app feature needs Runtime or managed Hermes behavior, it must gate on
the relevant Runtime capability health. Do not gate feature availability on
app-local connection fields such as `lastError`, sync timestamps, stored
Hermes state, or inferred process status.

Add a new capability when the existing ids do not describe the feature
requirement. Keep the capability check in Runtime, expose it through
`/capabilities`, and have the app read only the returned health record.

Prefer primitive capabilities over umbrella feature names. For example, if a
chat send only needs the managed Hermes Gateway to be ready, gate on
`gateway` instead of inventing a broader `agentExecution` or `agentTurns`
capability.

## Contract

Each capability has a stable id and one current health record.

| Field | Meaning |
| --- | --- |
| `id` | Stable capability id such as `apiServer`, `gateway`, or `cortexWiki`. |
| `displayName` | Human-readable name for settings and logs. |
| `healthy` | `true` only when Runtime can use the capability now. |
| `state` | `healthy`, `degraded`, `unavailable`, `unauthorized`, or `unknown`. |
| `reason` | Short user-facing explanation when the capability is not healthy. |
| `technicalMessage` | Raw failure detail for debugging. |
| `checkedAt` | Last time Runtime evaluated the capability. |
| `lastHealthyAt` | Last known healthy time, preserved across failures. |
| `nextCheckAt` | Next scheduled refresh time for this capability. |

`healthy` is the simple interface. `state` and messages explain why.

`displayName` and `reason` are product copy: they render directly in the app, so they use
product vocabulary ("agent engine", "the assistant") and never name Hermes. Runtime is the
single source for capability display names; the app renders `displayName` and falls back
to the capability id.

## Ownership

| Layer | Owns |
| --- | --- |
| Runtime | Capability definitions, checks, storage, API, and update job. |
| App backend | Runtime client/proxy and optional local cache for presentation only. |
| App UI | Rendering status, reason, timestamps, and actions. |
| Hermes | Execution-owned facts that Runtime may inspect while checking a capability. |

The app must not invent Runtime capability rows, run Runtime capability checks,
or use app-local capability state as the source of truth for Runtime job
enablement.

## Storage

Runtime stores capability health in Runtime SQLite.

```txt
runtime_capabilities
  id
  state
  healthy
  reason
  technical_message
  metadata_json
  checked_at
  last_healthy_at
  updated_at
```

Missing rows are valid during first boot. The Runtime API still lists expected
capabilities as `unknown` so the UI can show all known surfaces before the first
check runs.

## API

Runtime exposes capability health through the Admin API:

```txt
GET  /capabilities
GET  /capabilities/{id}
POST /capabilities/{id}/refresh
POST /capabilities/refresh
```

`GET /capabilities` also returns Runtime `info` and `health`. There is no
separate Runtime status contract; readiness belongs to capabilities.

## Update Job

Runtime has a scheduled job:

```txt
refresh-runtime-capabilities
```

The job runs on startup and on a short interval. It evaluates every Runtime
capability whose refresh policy is due and writes one health row per
capability. When the job writes a capability row, Runtime emits the same
`capability.updated` event used by manual refreshes so the app refetches without
operator action.

Each capability definition owns its refresh policy:

```ts
refresh: {
  intervalMs: number;
  runOnStart: boolean;
}
```

Domain writes may explicitly request a named capability refresh. Runtime does
not need a generic event subscription model for capabilities.

Capability checks are bounded. A slow or failing dependency marks only that
capability degraded; it does not block Runtime startup or unrelated checks.

## Feature Gating

Runtime jobs declare required capabilities in their job definition.

```ts
requiredCapabilities: ["gateway"]
```

Before scheduling, startup enqueue, manual enqueue, or execution, the job runner
queries Runtime capability health. If any required capability is not healthy,
the job is disabled with the capability reason.

Runtime jobs are one consumer of the broader feature-gating pattern. App pages,
controls, and smaller micro-features can use the same health records.

App navigation controls that open Runtime-backed surfaces must declare the
capabilities needed by that surface. If any required capability is not healthy,
the route button is disabled and explains the missing capabilities. App-local
surfaces such as profile, appearance, updates, and Runtime connection settings
do not require Runtime capabilities.

Feature gating does not make the app the source of truth. Runtime capability
health comes from Runtime.

## App Startup

The app shell and dashboard mount as soon as the Tavern App backend is ready.
Runtime connection checks run in the background. Synced records render from the
best local data available, and empty synced results are valid first-boot states.

Controls that can capture local draft state stay interactive while Runtime
boots. Commit actions that need Runtime or managed Hermes behavior disable
until the specific required capability is healthy. Surfaces whose only useful
content comes from Runtime may stay hidden or render an empty state until
synced data arrives.

Onboarding is the recovery surface for explicit setup, missing configuration,
or incompatible Runtime connections. Runtime startup is not a full-page loading
gate.

## Capability Events

Runtime emits `capability.updated` after a capability write. Managed Hermes
state changes use the same path: Gateway down writes updated Runtime capability
health, Runtime emits `capability.updated`, App backend re-fetches the
runtime's capability snapshot into its cached runtime-owned status, emits
`agent-runtime-capability.updated`, and the frontend invalidates
`agentRuntime.get`.

The App backend re-fetch is load-bearing: `agentRuntime.get` serves the cached
runtime-owned status without contacting Runtime, so a `capability.updated`
event that does not refresh the cache leaves the app on the snapshot taken at
connect time (for example, engine checks still warming during startup).

Frontend controls must render from the refreshed capability record. Do not
disable sends, cron actions, or other Hermes-backed actions from app-local
connection status.

## Capability Examples

Runtime capabilities cover first-party Runtime services, managed Hermes
integration points, and external dependencies.

| Capability | Healthy when |
| --- | --- |
| `dashboardServer` | Runtime can reach managed Hermes dashboard status at `/api/status`. |
| `apiServer` | Runtime can make an authenticated managed Hermes REST API call. |
| `gateway` | Runtime can open managed Hermes Gateway WebSocket `/api/ws`. |
| `cortexWiki` | The Cortex wiki hub can be read and the managed Hermes `cortex-wiki` skill has been prepared. Runtime reports write access in capability metadata because wiki maintenance needs it, but read-only hubs remain browseable. |
| `mnemosyneMemory` | Runtime has written managed assistant memory config, enabled host-LLM consolidation, and prepared the managed memory provider plugin. |
| `models` | Runtime can reach managed Hermes model inventory at `/api/model/options`. |
| `skills` | Runtime can reach managed Hermes skill inventory at `/api/skills`. App-side capability methods under `skills` also track the skill hub (`skill-hub.*`), toolset setup (`toolsets.config`/`toolsets.setup`), and MCP management (`mcp.*`) surfaces. |

Plain Tavern CRUD, timeline, mentions, cron, and logging surfaces are not
capabilities by themselves. Add a capability only when a user-facing action
depends on a distinct Runtime-owned service or Hermes probe.

## App Rendering

The Runtime settings page reads Runtime capability health and renders:

* one row per expected Runtime capability,
* capability groups by product category,
* stable row order inside each category,
* a status color from `state`,
* the last check time,
* the `reason` inline or in the row detail for non-healthy capabilities.

The app may cache the response for fast rendering, but the cache is not
authoritative.
