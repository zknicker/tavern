---
summary: Plugin API for Runtime-owned external service settings, secrets, health, and domain actions.
read_when:
  - adding or changing Tavern Plugins
  - changing MerchBase settings, health, or sales reads
  - changing Google settings, OAuth, Calendar reads, or Plugin Services
  - exposing external service actions to agents
---

# Plugins

Plugins are built-in Tavern Runtime capabilities for external systems. Runtime
owns their durable settings, stored secrets, health checks, and domain actions.

Plugin package docs refer to Tavern-managed, manifest-declared bundles that
collect tool code, agent guidance, product-owned actions, and Service
capabilities under one Plugin id.

Plugins are the user-facing integration unit. A Plugin may call an upstream API
directly, wrap a local CLI, or materialize an MCP server internally, but the
stable Tavern surface is the Plugin's settings, health, tools, and skills.

Plugin and Service enablement control live Plugin-backed behavior. Agent Plugin
grants control which agents may use Plugin-owned skills and tools during new
turns.

Runtime materializes Plugin-owned skills and tools for an agent turn only
when the Plugin is globally enabled, the Service
is enabled, required connection scopes are granted, and the Plugin is granted to
that agent. Disabled, unavailable, or ungranted Plugin abilities are omitted from
the agent-visible tool and guidance inventory. Runtime routes still reject
unavailable Plugin actions defensively.

Enablement writes are validated in order. Settings saves reject enabling a
Plugin whose required connection configuration is missing: MerchBase needs an
API key and Google needs a connected account. Disconnecting Google OAuth also
disables the Google Plugin. Grant writes reject enabling an agent Plugin grant
while the Plugin is globally disabled; disabling a grant is always allowed.

## Manifest

A Plugin manifest declares inventory and ownership metadata:

* Plugin id, name, and version.
* Settings and stored secrets.
* Plugin-level Runtime health capability ids.
* Services with their own health capability ids, agent-facing skills, and tools.

First-party manifests live under `@tavern/api/plugins`. Runtime, Server, and
Website registrations consume those manifests instead of duplicating Plugin
inventory in each layer.

In v1, Plugin manifests do not declare arbitrary executable wiring or enumerate
Plugin-internal read operations. Runtime and App import first-party Plugin
modules directly rather than dynamically loading JavaScript, React components,
or external package code from a manifest.

Core Tavern owns the Plugin host boundary: lifecycle, enablement, Service
enablement, grants, health registration, capability projection, and first-party
registration. The Plugin folder owns its domain-specific runtime reads, tool
implementations, component rendering behavior, and any helper APIs used by its
own components.
Those internals should not leak into the Plugin manifest or generic Tavern
product docs.

Settings uses the same host split. Core Tavern provides the Plugins settings
frame, enablement controls, health presentation, redacted list reads, settings
detail secret reveal behavior, and save/test affordances. The Plugin folder
owns domain-specific settings panel content, field validation copy, conflict
warnings, and repair guidance.

## Storage

Plugin records live in dedicated Runtime SQLite tables:

* `runtime_plugins`: enablement and non-secret `config_json`.
* `runtime_plugin_secrets`: credential `secret_json`.
* `runtime_capabilities`: current health such as `plugin.merchbase` or
  `plugin.google.calendar`.

Every Plugin declares one or more Services. Service definitions live in the
manifest. Runtime stores only dynamic Service state such as
`config_json.services.<serviceId>.enabled`.

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
GET  /plugins/google/settings
PUT  /plugins/google/settings
POST /plugins/google/oauth/start
GET  /plugins/google/oauth/sessions/{sessionId}
POST /plugins/google/oauth/sessions/{sessionId}/complete
POST /plugins/google/oauth/disconnect
POST /plugins/google/calendar/events
GET  /plugins/browser/settings
PUT  /plugins/browser/settings
POST /plugins/browser/open
POST /plugins/browser/restart
```

Settings writes require a Tavern caller. Sales reads require a healthy effective
MerchBase configuration and use the MerchBase public HTTP client.
Google OAuth and settings writes also require a Tavern caller. Calendar event
actions require the Google Plugin to be enabled, the Calendar Service to be
enabled, an OAuth connection to exist, and the Calendar events scope to be
granted. Browser settings writes and the open/restart actions require a Tavern
caller; both actions return the resulting browser status.

## Google

Google settings are:

* `enabled`
* `calendarEnabled`

The first Google Service is Calendar. It exposes event listing, search, and
create tools backed by the Calendar API. Runtime stores OAuth tokens in
`runtime_plugin_secrets.secret_json.oauth` with access token, optional refresh
token, expiry, account email, and granted scopes. The Calendar Service requires
`https://www.googleapis.com/auth/calendar.events`.

Tavern owns the Google OAuth client. Runtime reads the Tavern-owned desktop
client id and installed-app client secret from `TAVERN_GOOGLE_OAUTH_CLIENT_ID`
and `TAVERN_GOOGLE_OAUTH_CLIENT_SECRET` when set, then falls back to the
packaged Runtime asset `runtime-assets/google/oauth-client.json`. Release
packaging generates that asset from the release environment and ships it inside
the Runtime tarball; the values are not committed to the Tavern repo or written
to the Homebrew tap formula. The settings dialog does not ask users for Google
Cloud credentials. Google Desktop clients may include an installed-app client
secret; Google does not treat that value as a confidential secret for installed
apps. The current client lives in the Tavern Google Cloud project
`tavern-499717` as the `Tavern` Desktop OAuth client.

Settings starts a PKCE loopback OAuth flow. Runtime owns Google credentials,
PKCE state, token exchange, stored tokens, and the poll session. Tavern App
Server owns the browser-local callback listener and asks Runtime to use that
redirect URI, so OAuth works when Runtime is hosted on another machine. Direct
Runtime clients that do not provide a redirect URI may still let Runtime open
its own loopback listener. Agents are not told to run provider-specific setup
commands or manage OAuth from chat.

## MerchBase

MerchBase settings are:

* `enabled`
* `baseUrl`
* `defaultAccount`
* `defaultMarketplace`
* `apiKey` as a stored secret

Local dev may pre-seed Plugin settings with:

```txt
DEV_PRESEED_MERCHBASE_ENABLED
DEV_PRESEED_MERCHBASE_API_KEY
DEV_PRESEED_MERCHBASE_BASE_URL
DEV_PRESEED_MERCHBASE_DEFAULT_ACCOUNT
DEV_PRESEED_MERCHBASE_DEFAULT_MARKETPLACE
```

These are dev orchestration inputs, not Runtime config. On dev-stack startup,
the dev script copies those values into the Plugin tables only when the
corresponding Plugin config or secret row does not already exist. After that
seed, `runtime_plugins.enabled`, `runtime_plugins.config_json`, and
`runtime_plugin_secrets.secret_json` are the source of truth. Settings can still
enable, disable, or reconfigure the Plugin without `.env` winning on every read.

For a dev checkout that already has the MerchBase CLI configured, mirror the
CLI account into the checkout `.env`: `~/.merchbase/config.json` `baseUrl`,
`account`, and `marketplace` map to `DEV_PRESEED_MERCHBASE_BASE_URL`,
`DEV_PRESEED_MERCHBASE_DEFAULT_ACCOUNT`, and
`DEV_PRESEED_MERCHBASE_DEFAULT_MARKETPLACE`; the shell `MERCHBASE_API_KEY` maps
to `DEV_PRESEED_MERCHBASE_API_KEY`; set `DEV_PRESEED_MERCHBASE_ENABLED=true`
only when a new dev database should start with the Plugin enabled. Existing dev
databases keep their stored Plugin settings.

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

`merchbase_sales_series` is the typed sales data primitive for agents. It takes
the same query surface as the `plugin.merchbaseSalesSeries` tRPC endpoint —
`range` ("30d" or "YYYY-MM-DD..YYYY-MM-DD"), day/week/month `bucket`, and the
asin/color/facet/facetName/fit/marketplace/productType filters — and returns
model-shaped output: compact ISO-dated rows, summed totals, a `rowCount`, and
the resolved currency code. Daily ranges include explicit zero-sales days that
MerchBase omits upstream, so a zero row means no sales, not missing data.
Plugin-gated skill guidance (the same enabled-plus-granted gate as the
Plugin's tools) teaches agents to fetch sales data with this tool and present
the result themselves as inline visuals.

Settings -> Plugins owns MerchBase enablement. Agent Plugin grants decide which
agents receive the `merchbase` tools and Plugin-owned guidance. When Runtime
owns the flat `skills/merchbase` copy, Settings -> Skills may show that
read-only skill row as Plugin-owned evidence. The collision-safe plugin skill
remains available as `merchbase:merchbase` through `skill_view`; it is not
projected as an editable user skill. Direct skill or tool enablement changes
are rejected for Plugin-owned capabilities. Once the Plugin is enabled, the flat
`merchbase` name is reserved for Tavern's managed guide.

The generic read action endpoint accepts `{ "action": string, "input": object }`
for a strict allowlist. It is internal plumbing for Runtime-owned tools and
server bridges, not an agent prompting contract. It does not expose sync,
ripcord, ingestion, setup mutation, account switching, or secret changes.
Current-day sales requests default to a 10-day trend unless the user explicitly
asks for a one-day chart.

## Browser

Browser settings are:

* `enabled`
* `profileName` — a validated slug naming the Tavern-owned Chrome profile

Reads also return the detected Google Chrome application (path and version, or
null when Chrome is missing) and the current browser status: the supervision
state, reason, process and CDP detail, resource sample, and restart-budget
counters. The Plugin stores no secrets; browser credentials remain Chrome
profile state.

`POST /plugins/browser/open` starts or adopts the managed Chrome and brings it
to the foreground so users can sign in or install extensions with normal
Chrome UI. `POST /plugins/browser/restart` performs a guarded operator restart
that waits for active browser commands. Both require a Tavern caller and
return `{ ok, message, status }`.

Granted agents receive the single non-read-only `browser` tool and the managed
`browser` skill. Supervision internals, the launch contract, profiles, and
recovery policy are documented in [Browser internals](../internals/browser.md).

## Adding a Plugin

Add a new Plugin as a Runtime-owned capability, not as loose skill docs or
agent-side setup:

1. Add the Plugin id to `@tavern/api` Runtime contracts and expose narrow typed
   settings and health schemas.
2. Add a dedicated Runtime Plugin module backed by `runtime_plugins` and
   `runtime_plugin_secrets`. Keep Plugin list reads masked; settings detail
   reads may return secrets to the local owner so settings fields can reveal
   saved values.
3. Add Runtime routes for settings and read actions. Settings writes must
   require a Tavern caller and immediately refresh the Plugin capability.
4. Add a Runtime capability named `plugin.<id>` whose check proves the
   configured service can answer the agent-visible reads.
5. Add a Plugin manifest that declares the Plugin id, settings, secrets,
   Plugin-level capability ids, and Services. Services declare their
   capability ids, skills, and tool groups. Keep executable wiring in
   first-party Runtime and App imports.
6. Keep domain-specific read APIs, upstream calls, and component interaction
   logic inside the Plugin folder. Core Tavern should host registration and
   lifecycle, not know Plugin-domain operation names.
7. If agents should reason over a Service, install a managed Plugin package
   whose package name and public tool names use the Plugin id.
8. If agents need usage guidance, bundle a plugin skill with the same Plugin
   name and have the tools point agents at the package-qualified skill name,
   such as `merchbase:merchbase`. A flat starter skill may also be installed for
   auto-visible prompt behavior. If the Plugin needs to reserve that flat name,
   expose a settings conflict so the UI can warn before enabling. Enabling the
   Plugin replaces that flat skill with the managed starter skill.
9. Register Plugin-owned flat skills and tools in the server skill projection
   so Settings shows them in the Plugins tabs and rejects direct enablement
   writes. Treat plugin skills as collision-safe guidance unless the Settings
   product explicitly projects plugin skills.
10. Add Settings -> Plugins UI for enablement, health, settings, and secret
    reveal/update controls.
11. Keep displays agent-rendered: Plugin tools return model-shaped data and
    the visuals skill owns presentation. Plugins do not ship UI components.
12. Document the agent boundary: which reads are available and which
    operations stay user-managed.

Do not add user-installed Plugin packages in v1. For a new external
integration, either add a built-in Tavern Plugin or keep the work behind
advanced Runtime MCP plumbing until it is productized.
