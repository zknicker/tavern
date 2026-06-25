---
summary: Decision to make Tavern Plugins settings-managed Runtime capabilities, not agent-managed setup flows.
read_when:
  - adding or changing Plugin configuration, health, settings, agent tools, or Rich Response components
---

# Plugins are settings-managed Runtime capabilities

Tavern Plugins are configured and repaired through Tavern settings. Agents may
read Plugin health and use read-oriented Plugin actions through named Hermes
toolsets only when Runtime reports the capability usable. Sync, repair,
ingestion control, ripcord, account selection, secrets, and enablement stay
user-managed settings or app controls rather than agent tools. Future
agent-assisted setup must be a separate Tavern-wide settings approval flow, not
a Plugin-specific shortcut.

Plugin settings and secrets use dedicated Runtime Plugin tables. They do not
live in generic runtime metadata, Hermes home files, skill files, CLI config, or
environment variables. Runtime capabilities store current Plugin health
separately from the durable settings and secrets.

Plugin enablement is the source of truth for Plugin-provided agent
capabilities. Settings -> Skills and Settings -> Toolsets show Plugin-provided
skills and toolsets in their own Plugins tabs, and their row toggles are locked.
Users enable or disable the Plugin itself from Settings -> Plugins; Tavern then
reflects that state into the managed Hermes skill and toolset when possible.

The storage shape is Plugin-owned:

```sql
runtime_plugins(
  id TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL,
  config_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)

runtime_plugin_secrets(
  plugin_id TEXT PRIMARY KEY,
  secret_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)
```

For MerchBase, `runtime_plugins.config_json` stores non-secret settings
such as base URL, default account, and default marketplace.
`runtime_plugin_secrets.secret_json` stores the API key. API reads mask
secrets; widgets, the managed `merchbase` Hermes toolset, and settings routes
go through the Runtime Plugin service rather than reading these tables directly.
The managed `merchbase` skill is instruction-only: it describes when to use the
toolset and Rich Response, but does not expose raw Runtime API calls as the
agent contract.
