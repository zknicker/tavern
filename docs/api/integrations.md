---
summary: Integration API for Runtime-owned external service settings, secrets, health, and read-oriented domain actions.
read_when:
  - adding or changing Tavern Integrations
  - changing MerchBase settings, health, sales reads, or Integration-backed Rich Responses
  - exposing external service actions to agents or widgets
---

# Integrations

Integrations are first-party Tavern Runtime capabilities for external systems.
Runtime owns their durable settings, write-only secrets, health checks, and
read-oriented domain actions.

## Storage

Integration records live in dedicated Runtime SQLite tables:

* `runtime_integrations`: enablement and non-secret `config_json`.
* `runtime_integration_secrets`: write-only credential `secret_json`.
* `runtime_capabilities`: current health such as `integration.merchbase`.

Do not store Integration settings in generic runtime metadata, Hermes home,
skill files, CLI config, or checked-in env files.

## Runtime Routes

```txt
GET  /integrations
GET  /integrations/{id}
GET  /integrations/merchbase/settings
PUT  /integrations/merchbase/settings
POST /integrations/merchbase/action
POST /integrations/merchbase/sales/series
```

Settings writes require a Tavern caller. Sales reads require a healthy effective
MerchBase configuration and use the MerchBase public HTTP client.

## MerchBase

MerchBase settings are:

* `enabled`
* `baseUrl`
* `defaultAccount`
* `defaultMarketplace`
* `apiKey` as a write-only secret

Local dev may override effective settings with:

```txt
TAVERN_MERCHBASE_ENABLED
TAVERN_MERCHBASE_API_KEY
TAVERN_MERCHBASE_BASE_URL
TAVERN_MERCHBASE_DEFAULT_ACCOUNT
TAVERN_MERCHBASE_DEFAULT_MARKETPLACE
```

MerchBase actions exposed through Tavern stay read-oriented. Sync, ripcord,
ingestion control, setup repair, account switching, and secret changes remain
settings/user-managed flows.

Runtime ships the MerchBase starter guide in two places. The collision-safe copy
is bundled in the managed `merchbase` plugin as the read-only plugin skill
`merchbase:merchbase`. Runtime also installs an auto-visible flat
`skills/merchbase` copy when that path is empty or already Runtime-owned. If an
unmarked user-authored `skills/merchbase` exists, MerchBase settings report a
skill conflict. Enabling the Integration reserves the `merchbase` skill name:
Runtime deletes that existing skill directory and installs the managed copy so
the Integration owns the flat skill.

Runtime also installs and enables a managed Hermes plugin, `merchbase`.
That plugin registers the `merchbase` toolset with named read tools for status,
sales summary, sales records, sales series, sales breakdown, products, product
catalog, designs, and design facets. Agents should use those tools rather than
raw Runtime HTTP routes.

Settings -> Integrations owns MerchBase enablement. The `merchbase` toolset row
in Settings -> Toolsets -> Integrations is a read-only reflection of that
setting. When Runtime owns the flat `skills/merchbase` copy, Settings -> Skills
-> Integrations also shows that read-only skill row. The collision-safe plugin
skill remains available as `merchbase:merchbase` through `skill_view`; it is not
projected as an editable user skill. Direct skill or toolset enablement changes
are rejected for Integration-owned capabilities. Once the Integration is
enabled, the flat `merchbase` name is reserved for Tavern's managed guide.

The generic read action endpoint accepts `{ "action": string, "input": object }`
for a strict allowlist. It is internal plumbing for the managed Hermes toolset,
server bridge, and Runtime-owned widgets, not an agent prompting contract. It
does not expose sync, ripcord, ingestion, setup mutation, account switching, or
secret changes.

`MerchBaseSalesChart` is the preferred Rich Response component for presenting
MerchBase sales trends over a date range. It stores query intent durably and
fetches live sales data through Runtime when rendered. The display includes a
date range selector, Sales bars, a royalties line, and hover-driven stats for
the active day in the selected range. Current-day sales requests default to a
10-day trend unless the user explicitly asks for a one-day chart.

## Adding an Integration

Add a new Integration as a Runtime-owned capability, not as loose skill docs or
agent-side setup:

1. Add the Integration id to `@tavern/api` Runtime contracts and expose narrow
   typed settings, health, and action schemas.
2. Add a dedicated Runtime Integration module backed by `runtime_integrations`
   and `runtime_integration_secrets`. Keep secrets write-only and masked on
   reads.
3. Add Runtime routes for settings and read actions. Settings writes must require
   a Tavern caller and immediately refresh the Integration capability.
4. Add a Runtime capability named `integration.<id>` whose check proves the
   configured service can answer the agent-visible reads.
5. If agents should reason over the service, install a managed Hermes plugin
   whose plugin name, toolset id, and public tool names use the Integration id.
6. If agents need usage guidance, bundle a plugin skill with the same
   Integration name and have the tools point agents at the qualified
   `integration:skill` name. A flat starter skill may also be installed for
   auto-visible prompt behavior. If the Integration needs to reserve that flat
   name, expose a settings conflict so the UI can warn before enabling.
   Enabling the Integration replaces that flat skill with the managed starter
   skill.
7. Register Integration-owned flat skills and toolsets in the server skill
   projection so Settings shows them in the Integrations tabs and rejects direct
   enablement writes. Treat plugin skills as collision-safe guidance unless the
   Settings product explicitly projects plugin skills.
8. Add Settings -> Integrations UI for enablement, health, non-secret settings,
   and write-only secret updates.
9. Add a Rich Response component only when the display is a product concept, not
   a generic chart/table assembly problem. Store query intent and fetch live data
   through Runtime while rendering.
10. Document the agent boundary: which reads are available, which operations stay
    user-managed, and which widget is preferred for common displays.
