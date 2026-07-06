---
summary: Plugin API for Runtime-owned external service settings, secrets, health, and domain actions.
read_when:
  - adding or changing Tavern Plugins
  - changing MerchBase settings, health, sales reads, or Plugin-backed Widgets
  - changing Google settings, OAuth, Calendar reads, or Plugin Services
  - exposing external service actions to agents or widgets
---

# Plugins

Plugins are built-in Tavern Runtime capabilities for external systems. Runtime
owns their durable settings, write-only secrets, health checks, and domain
actions.

Plugin package docs refer to Tavern-managed, manifest-declared bundles that
collect tool code, agent guidance, product-owned actions, and Service
capabilities under one Plugin id.

Plugins are the user-facing integration unit. A Plugin may call an upstream API
directly, wrap a local CLI, or materialize an MCP server internally, but the
stable Tavern surface is the Plugin's settings, health, tools, skills, and Widgets.

Plugin and Service enablement control live Plugin-backed behavior. Agent Plugin
grants control which agents may use Plugin-owned skills, tools, and Widget
Components during new turns. Historical chat rows with compiled Plugin-owned
Widgets still render after a grant is removed, but Plugin-backed
interaction controls are disabled when the Plugin is globally disabled.

Runtime materializes Plugin-owned skills, tools, and Widget authoring
guidance for an agent turn only when the Plugin is globally enabled, the Service
is enabled, required connection scopes are granted, and the Plugin is granted to
that agent. Disabled, unavailable, or ungranted Plugin abilities are omitted from
the agent-visible tool and guidance inventory. Runtime routes still reject
unavailable Plugin actions defensively.

## Manifest

A Plugin manifest declares inventory and ownership metadata:

* Plugin id, name, and version.
* Settings and write-only secrets.
* Plugin-level Runtime health capability ids.
* Services with their own health capability ids, agent-facing skills, and tools.
* Widgets owned by the Plugin.

First-party manifests live under `@tavern/api/plugins`. Runtime, Server, and
Website registrations consume those manifests instead of duplicating Plugin
inventory in each layer.

In v1, Plugin manifests do not declare arbitrary executable wiring or enumerate
Plugin-internal read operations. Runtime and App import first-party Plugin
modules directly rather than dynamically loading JavaScript, React components,
or external package code from a manifest. Widget source may
live inside the Plugin folder, but build-time imports register its schema and
renderer with Tavern's typed catalog.

Core Tavern owns the Plugin host boundary: lifecycle, enablement, Service
enablement, grants, health registration, capability projection, and first-party
registration. The Plugin folder owns its domain-specific runtime reads, tool
implementations, component rendering behavior, and any helper APIs used by its
own components.
Those internals should not leak into the Plugin manifest or generic Tavern
product docs.

Settings uses the same host split. Core Tavern provides the Plugins settings
frame, enablement controls, health presentation, secret redaction behavior, and
save/test affordances. The Plugin folder owns domain-specific settings panel
content, field validation copy, conflict warnings, and repair guidance.

Dev-mode demos use the same Plugin ownership boundary. Each Plugin-owned Widget should have one matching `dev/<widget>.demo.ts` module
inside the Plugin folder. That module owns seeded chat rows, the Widget
payload, and any inline fake data needed by the dev app. Core Tavern only
aggregates those demos; it does not know Plugin-specific demo data or operation
names.

## Storage

Plugin records live in dedicated Runtime SQLite tables:

* `runtime_plugins`: enablement and non-secret `config_json`.
* `runtime_plugin_secrets`: write-only credential `secret_json`.
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
POST /plugins/google/oauth/disconnect
POST /plugins/google/calendar/events
```

Settings writes require a Tavern caller. Sales reads require a healthy effective
MerchBase configuration and use the MerchBase public HTTP client.
Google OAuth and settings writes also require a Tavern caller. Calendar event
actions require the Google Plugin to be enabled, the Calendar Service to be
enabled, an OAuth connection to exist, and the Calendar events scope to be
granted.

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

Settings starts a PKCE loopback OAuth flow from Runtime. Runtime opens a local
callback server, returns the authorization URL and session id, stores tokens
after the callback, and exposes a poll route for the app to observe completion.
Agents are not told to run provider-specific setup commands or manage OAuth
from chat.

## MerchBase

MerchBase settings are:

* `enabled`
* `baseUrl`
* `defaultAccount`
* `defaultMarketplace`
* `apiKey` as a write-only secret

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

Settings -> Plugins owns MerchBase enablement. Agent Plugin grants decide which
agents receive the `merchbase` tools and Plugin-owned guidance. When Runtime
owns the flat `skills/merchbase` copy, Settings -> Skills may show that
read-only skill row as Plugin-owned evidence. The collision-safe plugin skill
remains available as `merchbase:merchbase` through `skill_view`; it is not
projected as an editable user skill. Direct skill or tool enablement changes
are rejected for Plugin-owned capabilities. Once the Plugin is enabled, the flat
`merchbase` name is reserved for Tavern's managed guide.

The generic read action endpoint accepts `{ "action": string, "input": object }`
for a strict allowlist. It is internal plumbing for Runtime-owned tools, server
bridges, and Plugin-backed Widgets, not an agent prompting contract. It
does not expose sync, ripcord, ingestion, setup mutation, account switching, or
secret changes.

`merchbase-sales-chart` is the preferred Widget component for presenting
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
   settings and health schemas.
2. Add a dedicated Runtime Plugin module backed by `runtime_plugins` and
   `runtime_plugin_secrets`. Keep secrets write-only and masked on reads.
3. Add Runtime routes for settings and read actions. Settings writes must
   require a Tavern caller and immediately refresh the Plugin capability.
4. Add a Runtime capability named `plugin.<id>` whose check proves the
   configured service can answer the agent-visible reads.
5. Add a Plugin manifest that declares the Plugin id, settings, secrets,
   Plugin-level capability ids, Services, and Widgets. Services
   declare their capability ids, skills, and tool groups. Plugin-owned
   component source may live under the Plugin folder, but keep executable wiring
   in first-party Runtime and App imports.
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
10. Add Settings -> Plugins UI for enablement, health, non-secret settings, and
   write-only secret updates.
11. Add a Widget only when the display is a product concept, not
    a generic chart/table assembly problem. Store query intent and fetch live data
    through Runtime while rendering.
12. Add a matching Plugin-local `dev/<component>.demo.ts` module for every
    Plugin-owned Widget so dev mode can exercise it through
    normal seeded chat rows. Keep demo data in that one file unless duplication
    becomes painful.
13. Document the agent boundary: which reads are available, which operations stay
    user-managed, and which widget is preferred for common displays.

Do not add user-installed Plugin packages in v1. For a new external
integration, either add a built-in Tavern Plugin or keep the work behind
advanced Runtime MCP plumbing until it is productized.
