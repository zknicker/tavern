---
summary: Plugins feature for Runtime-owned external service settings, health, agent tools, and Plugin-backed Rich Responses.
read_when:
  - changing the Plugins settings surface
  - changing Plugin-owned skills, tools, health, or Rich Responses
  - adding a first-party external service capability
---

# Plugins

Plugins connect Tavern to built-in external systems through Runtime-owned
Services and tools. Settings owns setup, credentials, Service enablement, health,
and repair; agents only get Plugin tools when the Plugin and Service are usable.

## In the box

* **Settings -> Agents -> Plugins.** Users enable or disable built-in
  Tavern Plugins and edit non-secret settings plus write-only secrets.
* **Plugin and Service health.** Runtime capability checks report whether a
  Plugin connection or Service is ready for agent-visible reads.
* **Plugin skills and tools.** Enabled Plugin Services expose their agent-facing
  skills and tools through Plugin grants.
* **MerchBase.** The first Plugin provides read-only sales, product, catalog,
  and design tools plus the `MerchBaseSalesChart` Rich Response.
* **Google.** The Google Plugin starts with Google Calendar. Settings manages
  loopback authorization, stored tokens, and the Calendar Service toggle. The
  app ships the Tavern-owned Google OAuth client.

## Contract

Plugins are Runtime-owned product capabilities and Tavern-managed,
manifest-declared bundles. Runtime stores their settings, masks secrets on
reads, checks health, stores Service enablement, and exposes narrow read actions
for managed tools and Rich Responses.

Plugins are Tavern's normal user-facing integration surface. A Plugin may be
implemented with direct API calls, local commands, or MCP internally, but users
configure the Plugin rather than installing arbitrary tool packages or raw MCP
servers in the default product flow.

Plugin enablement, Service enablement, and the agent's Plugin grant are the
source of truth for Plugin-owned skills and tools. Users do not enable
individual Plugin tool rows. Runtime only materializes Plugin-owned skills,
tools, and Rich Response authoring guidance into an agent turn when the Plugin
is enabled, the Service is enabled, required connection scopes are granted, and
the Plugin is granted to that agent.

The Plugin manifest declares inventory and ownership metadata: Plugin id, name,
version, settings, secrets, Plugin-level health capability ids, Services, and
Rich Response Components. Each Service declares its own health capability ids,
agent-facing skills, and tool groups. In v1, manifests do not declare arbitrary
executable wiring or enumerate Plugin-internal read operations. Runtime and App
still import first-party Plugin modules directly.

Core Tavern hosts Plugin lifecycle, enablement, grants, health, and registration.
Plugin folders own domain-specific reads, tools, component behavior, and helper
APIs. MerchBase operation names should stay in the MerchBase Plugin, not in
generic Tavern docs or manifests.

Settings follows the same split. Core Tavern provides the Plugins settings
frame, enablement controls, health presentation, secret redaction behavior, and
save/test affordances. Plugin settings dialogs use Tavern's canonical Plugin
dialog shell, a Services section for Service enablement, and a Connection
section for account credentials or OAuth state. Standard text and secret config
uses field descriptors. OAuth client ids that ship with Tavern are
infrastructure config, not user-facing Plugin settings. Service rows use Service
descriptors so adding another Service does not require new dialog layout code.
The Plugin folder owns its domain-specific field config, validation copy,
conflict warnings, and workflow actions such as OAuth connect or disconnect.

Low-level API, table, and capability ids use Plugin names such as `/plugins`,
`runtime_plugins`, `plugin.merchbase`, and `plugin.google.calendar`.

## Boundaries

Agents may read Plugin status and use read-oriented Plugin tools. They do not
run sync, ripcord, ingestion, account switching, setup repair, or secret-changing
flows. Those stay user-managed settings or app controls.

Plugin packages are implementation packaging. Tavern shows the Plugin,
agent-facing skill, tool, or Rich Response Component, not a user-installed
package as a separate product row.

## Related Docs

* [Plugins API](../api/plugins.md)
* [Plugins ADR](../adr/0004-plugins-are-settings-managed-runtime-capabilities.md)
* [Skills and Tools](skills.md)
