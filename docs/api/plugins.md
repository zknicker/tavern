---
summary: Plugin API for Runtime-owned external service settings, secrets, health, and read-oriented domain actions.
read_when:
  - adding or changing Tavern Plugins
  - changing MerchBase settings, health, sales reads, or Plugin-backed Rich Responses
  - exposing external service actions to agents or widgets
---

# Plugins

Plugins are built-in Tavern Runtime capabilities for external systems. Runtime
owns their durable settings, write-only secrets, health checks, and read-oriented
domain actions.

Plugin package docs refer to Tavern-managed packages that bundle tool code,
agent guidance, and product-owned read actions.

Plugins are the user-facing integration unit. A Plugin may call an upstream API
directly, wrap a local CLI, or materialize an MCP server internally, but the
stable Tavern surface is the Plugin's settings, health, tools, skills, and Rich
Responses.

## Storage

Plugin records live in dedicated Runtime SQLite tables:

* `runtime_plugins`: enablement and non-secret `config_json`.
* `runtime_plugin_secrets`: write-only credential `secret_json`.
* `runtime_capabilities`: current health such as `plugin.merchbase`.

Do not store Plugin settings in generic runtime metadata, skill files, CLI
config, or checked-in env files.

## Runtime Routes

```txt
GET  /plugins
GET  /plugins/{id}
GET  /plugins/merchbase/settings
PUT  /plugins/merchbase/settings
POST /plugins/merchbase/action
POST /plugins/merchbase/sales/series
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

When `TAVERN_MERCHBASE_ENABLED` or `TAVERN_MERCHBASE_API_KEY` is present,
Runtime reports MerchBase enablement as environment-controlled and the app
disables the enablement switch. Set `TAVERN_MERCHBASE_ENABLED=false` to keep an
env-provided API key configured while turning the Plugin off.

For a dev checkout that already has the MerchBase CLI configured, mirror the
CLI account into the checkout `.env`: `~/.merchbase/config.json` `baseUrl`,
`account`, and `marketplace` map to `TAVERN_MERCHBASE_BASE_URL`,
`TAVERN_MERCHBASE_DEFAULT_ACCOUNT`, and
`TAVERN_MERCHBASE_DEFAULT_MARKETPLACE`; the shell `MERCHBASE_API_KEY` maps to
`TAVERN_MERCHBASE_API_KEY`; set `TAVERN_MERCHBASE_ENABLED=true`. Restart the dev
stack after changing `.env`.

MerchBase actions exposed through Tavern stay read-oriented. Sync, ripcord,
ingestion control, setup repair, account switching, and secret changes remain
settings/user-managed flows.

Runtime ships the MerchBase starter guide in two places. The collision-safe copy
is bundled in the managed `merchbase` Plugin package as the read-only Plugin
skill `merchbase:merchbase`. Runtime also installs an auto-visible flat
`skills/merchbase` copy when that path is empty or already Runtime-owned. If an
unmarked user-authored `skills/merchbase` exists, MerchBase settings report a
skill conflict. Enabling the Plugin reserves the `merchbase` skill name:
Runtime deletes that existing skill directory and installs the managed copy so
the Plugin owns the flat skill.

Runtime also installs and enables a managed Plugin package,
`merchbase`. That package registers `merchbase` tools with named read
tools for status, sales summary, sales records, sales series, sales breakdown,
products, product catalog, designs, and design facets. Agents should use those
tools rather than raw Runtime HTTP routes.

Settings -> Plugins owns MerchBase enablement. Agent Plugin grants decide which
agents receive the `merchbase` tools and Plugin-owned guidance. When Runtime
owns the flat `skills/merchbase` copy, Settings -> Skills may show that
read-only skill row as Plugin-owned evidence. The collision-safe plugin skill
remains available as `merchbase:merchbase` through `skill_view`; it is not
projected as an editable user skill. Direct skill or tool enablement changes
are rejected for Plugin-owned capabilities. Once the Plugin is enabled, the flat
`merchbase` name is reserved for Tavern's managed guide.

The generic read action endpoint accepts `{ "action": string, "input": object }`
for a strict allowlist. It is internal plumbing for Runtime-owned tools,
server bridges, and Runtime-owned widgets, not an agent prompting contract. It
does not expose sync, ripcord, ingestion, setup mutation, account switching, or
secret changes.

`MerchBaseSalesChart` is the preferred Rich Response component for presenting
MerchBase sales trends over a date range. It stores query intent durably and
fetches live sales data through Runtime when rendered. The display includes a
date range selector, Sales bars, a royalties line, and hover-driven stats for
the active day in the selected range. Daily ranges render every selected day,
including zero-sales days that MerchBase omits from the upstream series.
Current-day sales requests default to a 10-day trend unless the user explicitly
asks for a one-day chart.

## Adding a Plugin

Add a new Plugin as a Runtime-owned capability, not as loose skill docs or
agent-side setup:

1. Add the Plugin id to `@tavern/api` Runtime contracts and expose narrow typed
   settings, health, and action schemas.
2. Add a dedicated Runtime Plugin module backed by `runtime_plugins` and
   `runtime_plugin_secrets`. Keep secrets write-only and masked on reads.
3. Add Runtime routes for settings and read actions. Settings writes must
   require a Tavern caller and immediately refresh the Plugin capability.
4. Add a Runtime capability named `plugin.<id>` whose check proves the
   configured service can answer the agent-visible reads.
5. If agents should reason over the service, install a managed Plugin package
   whose package name and public tool names use the Plugin id.
6. If agents need usage guidance, bundle a plugin skill with the same Plugin
   name and have the tools point agents at the package-qualified skill name,
   such as `merchbase:merchbase`. A flat starter skill may also be installed for
   auto-visible prompt behavior. If the Plugin needs to reserve that flat name,
   expose a settings conflict so the UI can warn before enabling. Enabling the
   Plugin replaces that flat skill with the managed starter skill.
7. Register Plugin-owned flat skills and tools in the server skill projection
   so Settings shows them in the Plugins tabs and rejects direct enablement
   writes. Treat plugin skills as collision-safe guidance unless the Settings
   product explicitly projects plugin skills.
8. Add Settings -> Plugins UI for enablement, health, non-secret settings, and
   write-only secret updates.
9. Add a Rich Response component only when the display is a product concept, not
   a generic chart/table assembly problem. Store query intent and fetch live data
   through Runtime while rendering.
10. Document the agent boundary: which reads are available, which operations stay
    user-managed, and which widget is preferred for common displays.

Do not add user-installed Plugin packages in v1. For a new external
integration, either add a built-in Tavern Plugin or keep the work behind
advanced Runtime MCP plumbing until it is productized.
