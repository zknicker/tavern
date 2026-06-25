---
summary: Plugins feature for Runtime-owned external service settings, health, agent tools, and Plugin-backed Rich Responses.
read_when:
  - changing the Plugins settings surface
  - changing Plugin-owned skills, toolsets, health, or Rich Responses
  - adding a first-party external service capability
---

# Plugins

Plugins connect Tavern to first-party external service capabilities that the
agent can read through Runtime-owned tools. Settings owns setup, credentials,
health, enablement, and repair; agents only get read-oriented toolsets when the
Plugin is usable.

## In the box

* **Settings -> Plugins.** Users enable or disable Plugins and edit non-secret
  settings plus write-only secrets.
* **Plugin health.** Runtime capability checks report whether a Plugin is ready
  for agent-visible reads.
* **Plugin skills and toolsets.** Settings -> Skills -> Plugins and Settings ->
  Toolsets -> Plugins show read-only rows contributed by enabled Plugins.
* **MerchBase.** The first Plugin provides read-only sales, product, catalog,
  and design tools plus the `MerchBaseSalesChart` Rich Response.

## Contract

Plugins are Runtime-owned product capabilities. Runtime stores their settings,
masks secrets on reads, checks health, and exposes narrow read actions for
managed tools and widgets.

Plugin enablement is the single source of truth for Plugin-owned skills and
toolsets. Users cannot enable or disable those rows from Skills or Toolsets;
they change the Plugin itself.

Low-level API, table, and capability ids use Plugin names such as `/plugins`,
`runtime_plugins`, and `plugin.merchbase`.

## Boundaries

Agents may read Plugin status and use read-oriented Plugin tools. They do not
run sync, ripcord, ingestion, account switching, setup repair, or secret-changing
flows. Those stay user-managed settings or app controls.

Hermes plugin packages are implementation packaging. Tavern shows the
agent-facing skill or toolset, not the package as a separate product row.

## Related Docs

* [Plugins API](../api/plugins.md)
* [Plugins ADR](../adr/0004-plugins-are-settings-managed-runtime-capabilities.md)
* [Skills & Toolsets](skills.md)
