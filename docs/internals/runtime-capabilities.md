---
summary: Runtime-owned capability health; the singular feature-gating contract between Tavern App and Tavern Runtime.
read_when:
  - changing Runtime capability checks, capability storage, or capability APIs
  - changing job enablement that depends on Runtime readiness
  - gating Tavern App features on Runtime or managed OpenClaw readiness
  - changing chat send, runtime sync, skills, models, mentions, jobs, or OpenClaw-backed app behavior
  - changing the Tavern Runtime settings capability table
---

# Runtime Capabilities

Runtime capabilities are health records for Runtime-owned services and
dependencies. Runtime owns the checks, stores the results, exposes them through
the Admin API, and makes them available to other product surfaces.

Capabilities are a readiness primitive. Jobs, micro-features, and whole app
pages can use capability health to decide whether a feature is available,
degraded, or blocked.

The app only renders capability state. It does not decide whether a Runtime
capability is healthy.

## App Rule

Runtime capabilities are the app's singular readiness interface.

If an app feature needs Runtime or managed OpenClaw behavior, it must gate on
the relevant Runtime capability health. Do not gate feature availability on
app-local connection fields such as `lastError`, sync timestamps, stored
OpenClaw state, or inferred process status.

Add a new capability when the existing ids do not describe the feature
requirement. Keep the capability check in Runtime, expose it through
`/capabilities`, and have the app read only the returned health record.

Prefer primitive capabilities over umbrella feature names. For example, if a
chat send only needs the managed OpenClaw Gateway to be ready, gate on
`gateway` instead of inventing a broader `agentExecution` or `agentTurns`
capability.

## Contract

Each capability has a stable id and one current health record.

| Field | Meaning |
| --- | --- |
| `id` | Stable capability id such as `status`, `memory`, or `embeddingModel`. |
| `displayName` | Human-readable name for settings and logs. |
| `healthy` | `true` only when Runtime can use the capability now. |
| `state` | `healthy`, `degraded`, `unavailable`, `unauthorized`, or `unknown`. |
| `reason` | Short user-facing explanation when the capability is not healthy. |
| `technicalMessage` | Raw failure detail for debugging. |
| `checkedAt` | Last time Runtime evaluated the capability. |
| `lastHealthyAt` | Last known healthy time, preserved across failures. |
| `nextCheckAt` | Next scheduled refresh time for this capability. |

`healthy` is the simple interface. `state` and messages explain why.

## Ownership

| Layer | Owns |
| --- | --- |
| Runtime | Capability definitions, checks, storage, API, and update job. |
| App backend | Runtime client/proxy and optional local cache for presentation only. |
| App UI | Rendering status, reason, timestamps, and actions. |
| OpenClaw | Execution-owned facts that Runtime may inspect while checking a capability. |

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
capability.

Each capability definition owns its refresh policy:

```ts
refresh: {
  intervalMs: number;
  runOnStart: boolean;
}
```

Domain writes may explicitly request a named capability refresh. For example,
saving Cortex embedding settings can request an immediate `embeddingModel`
refresh. Runtime does not need a generic event subscription model for
capabilities.

Capability checks are bounded. A slow or failing dependency marks only that
capability degraded; it does not block Runtime startup or unrelated checks.

## Feature Gating

Runtime jobs declare required capabilities in their job definition.

```ts
requiredCapabilities: ["embeddingModel"]
```

Before scheduling, startup enqueue, manual enqueue, or execution, the job runner
queries Runtime capability health. If any required capability is not healthy,
the job is disabled with the capability reason.

Runtime jobs are one consumer of the broader feature-gating pattern. App pages,
controls, and smaller micro-features can use the same health records.

Feature gating does not make the app the source of truth. Runtime capability
health comes from Runtime.

## Capability Examples

Runtime capabilities cover first-party Runtime services, managed OpenClaw
integration points, and external dependencies.

| Capability | Healthy when |
| --- | --- |
| `status` | Runtime is reachable and returns its capability contract. |
| `tavernPlugin` | Managed OpenClaw reports the Tavern plugin is installed. |
| `gateway` | Runtime owns a ready managed OpenClaw Gateway process. |
| `memory` | Managed OpenClaw Gateway is ready and memory state can be refreshed. |
| `mentions` | Runtime can expose mention/search hooks used by Tavern tools. |
| `cortexDatabase` | Cortex SQLite schema exists and is usable. Empty Cortex stores are still healthy. |
| `cortexWiki` | The Cortex wiki path can be read and written, or its parent path can host an empty wiki. |
| `embeddingModel` | Cortex embedding settings are usable and recent embedding failures do not indicate auth or quota failure. |
| `models` | Runtime can serve the current model inventory. If Gateway is down, cached inventory is degraded. |
| `skills` | Runtime can serve the current skill inventory. If Gateway is down, cached inventory is degraded. |

## App Rendering

The Runtime settings page reads Runtime capability health and renders:

* one row per expected Runtime capability,
* a status color from `state`,
* the last check time,
* the `reason` inline or in the row detail for non-healthy capabilities.

The app may cache the response for fast rendering, but the cache is not
authoritative.
