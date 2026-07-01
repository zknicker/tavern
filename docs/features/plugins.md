---
summary: Plugins feature for Runtime-owned external service settings, health, agent tools, and Plugin-backed Rich Responses.
read_when:
  - changing the Plugins settings surface
  - changing Plugin-owned skills, tools, health, or Rich Responses
  - adding a first-party external service capability
---

# Plugins

Plugins connect Tavern to built-in external service capabilities that the agent
can read through Runtime-owned tools. Settings owns setup, credentials, health,
enablement, and repair; agents only get read-oriented tools when the Plugin is
usable.

## In the box

* **Settings -> Agents -> Plugins.** Users enable or disable built-in
  Tavern Plugins and edit non-secret settings plus write-only secrets.
* **Plugin health.** Runtime capability checks report whether a Plugin is ready
  for agent-visible reads.
* **Plugin skills and tools.** Enabled Plugins expose their agent-facing skills
  and tools through Plugin grants.
* **MerchBase.** The first Plugin provides read-only sales, product, catalog,
  and design tools plus the `MerchBaseSalesChart` Rich Response.

## Contract

Plugins are Runtime-owned product capabilities. Runtime stores their settings,
masks secrets on reads, checks health, and exposes narrow read actions for
managed tools and widgets.

Plugins are Tavern's normal user-facing integration surface. A Plugin may be
implemented with direct API calls, local commands, or MCP internally, but users
configure the Plugin rather than installing arbitrary tool packages or raw MCP
servers in the default product flow.

Plugin enablement plus the agent's Plugin grant is the source of truth for
Plugin-owned skills and tools. Users do not enable individual Plugin tool rows.

Low-level API, table, and capability ids use Plugin names such as `/plugins`,
`runtime_plugins`, and `plugin.merchbase`.

## Boundaries

Agents may read Plugin status and use read-oriented Plugin tools. They do not
run sync, ripcord, ingestion, account switching, setup repair, or secret-changing
flows. Those stay user-managed settings or app controls.

Plugin packages are implementation packaging. Tavern shows the built-in Plugin,
agent-facing skill, or tool, not a user-installed package as a separate product
row.

## Related Docs

* [Plugins API](../api/plugins.md)
* [Plugins ADR](../adr/0004-plugins-are-settings-managed-runtime-capabilities.md)
* [Skills and Tools](skills.md)
