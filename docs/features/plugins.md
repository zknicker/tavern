---
summary: Plugins feature for Runtime-owned external service settings, health, agent tools, and Plugin-backed Widgets.
read_when:
  - changing the Plugins settings surface
  - changing Plugin-owned skills, tools, health, or Widgets
  - adding a first-party external service capability
---

# Plugins

Plugins connect Tavern to built-in external systems through Runtime-owned
Services and tools. Settings owns setup, credentials, Service enablement, health,
and repair; agents only get Plugin tools when the Plugin and Service are usable.

## In the box

* **Settings -> Plugins.** Users enable or disable built-in Tavern Plugins and
  edit Plugin settings and secrets. Per-agent grants live on each agent's
  Skills & Plugins page.
* **Plugin and Service health.** Runtime capability checks report whether a
  Plugin connection or Service is ready for agent-visible reads.
* **Plugin skills and tools.** Enabled Plugin Services expose their agent-facing
  skills and tools through Plugin grants.
* **MerchBase.** The first Plugin provides read-only sales, product, catalog,
  and design tools plus the `merchbase-sales-chart` Widget. The
  `merchbase_sales_series` tool is the typed sales primitive: granted agents
  fetch ISO-dated rows and totals (daily ranges include explicit zero-sales
  days) and present the data themselves; plugin-gated prompt guidance teaches
  that flow.
* **Google.** The Google Plugin starts with Google Calendar. Settings manages
  loopback authorization, stored tokens, and the Calendar Service toggle. The
  app ships the Tavern-owned Google OAuth client.
* **Browser.** The Browser Plugin supervises one visible managed Google Chrome
  with a durable named profile and gives granted agents one `browser` tool that
  runs agent-browser commands against it. Settings shows the detected Chrome,
  the profile name, browser health, and Open/Restart actions. See
  [Browser internals](../internals/browser.md).

## Contract

Plugins are Runtime-owned product capabilities and Tavern-managed,
manifest-declared bundles. Runtime stores their settings, keeps list and summary
reads redacted, returns secrets to the local owner in settings detail views,
checks health, stores Service enablement, and exposes narrow read actions for
managed tools and Widgets.

Plugins are Tavern's normal user-facing integration surface. A Plugin may be
implemented with direct API calls, local commands, or MCP internally, but users
configure the Plugin rather than installing arbitrary tool packages or raw MCP
servers in the default product flow.

Plugin enablement, Service enablement, and the agent's Plugin grant are the
source of truth for Plugin-owned skills and tools. Users do not enable
individual Plugin tool rows. Runtime only materializes Plugin-owned skills,
tools, and Widget authoring guidance into an agent turn when the Plugin
is enabled, the Service is enabled, required connection scopes are granted, and
the Plugin is granted to that agent.

Enablement is ordered: a Plugin cannot be enabled until its required connection
configuration exists (a MerchBase API key, a connected Google account), and an
agent grant cannot be enabled until the Plugin is globally enabled. Runtime
rejects out-of-order enablement writes, disconnecting Google disables the
Plugin, and the app only offers adding globally enabled Plugins to an agent.
Existing grants survive a global disable; they stay listed on the agent's
Skills & Plugins page with a short hint and resume when the Plugin is enabled
again.

The Plugin manifest declares inventory and ownership metadata: Plugin id, name,
version, settings, secrets, Plugin-level health capability ids, Services, and
Widgets. Each Service declares its own health capability ids,
agent-facing skills, and tool groups. In v1, manifests do not declare arbitrary
executable wiring or enumerate Plugin-internal read operations. Runtime and App
still import first-party Plugin modules directly.

Core Tavern hosts Plugin lifecycle, enablement, grants, health, and registration.
Plugin folders own domain-specific reads, tools, component behavior, and helper
APIs. MerchBase operation names should stay in the MerchBase Plugin, not in
generic Tavern docs or manifests.

Settings follows the same split. Core Tavern provides the Plugins settings
frame, enablement controls, health presentation, list redaction, secret reveal
behavior, and save/test affordances. Plugin settings dialogs use Tavern's
canonical Plugin dialog shell, a Services section for Service enablement, and a
Connection section for account credentials or OAuth state. Standard text and
secret config uses field descriptors. OAuth client ids that ship with Tavern are
infrastructure config, not user-facing Plugin settings. Service rows use Service
descriptors so adding another Service does not require new dialog layout code.
The Plugin folder owns its domain-specific field config, validation copy,
conflict warnings, and workflow actions such as OAuth connect or disconnect.

Low-level API, table, and capability ids use Plugin names such as `/plugins`,
`runtime_plugins`, `plugin.merchbase`, and `plugin.google.calendar`.

## Boundaries

Agents may read Plugin status and use granted Plugin tools. Most Plugin tools
are read-oriented; the Browser tool drives the managed browser and is the
deliberate exception. Agents do not run sync, ripcord, ingestion, account
switching, setup repair, or secret-changing flows. Those stay user-managed
settings or app controls.

Plugin packages are implementation packaging. Tavern shows the Plugin,
agent-facing skill, tool, or Widget, not a user-installed
package as a separate product row.

## Related Docs

* [Plugins API](../api/plugins.md)
* [Plugins ADR](../adr/0004-plugins-are-settings-managed-runtime-capabilities.md)
* [Skills and Tools](skills.md)
