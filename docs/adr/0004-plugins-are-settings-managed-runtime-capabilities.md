---
summary: Decision to make Tavern Plugins settings-managed Runtime capabilities, not agent-managed setup flows.
read_when:
  - adding or changing Plugin configuration, health, settings, agent tools, or Rich Response components
---

# Plugins are settings-managed Runtime capabilities

Tavern Plugins are built-in capabilities configured and repaired through Tavern
settings. Agents may read Plugin health and use read-oriented Plugin actions
through named Runtime tools only when Runtime reports the capability usable.
Sync, repair, ingestion control, ripcord, account selection, secrets, and
enablement stay user-managed settings or app controls rather than agent tools.
Future agent-assisted setup must run through a Tavern-wide settings flow, not a
Plugin-specific shortcut.

Plugins are the normal product direction for integrations. Raw MCP servers may
exist as Runtime plumbing or an advanced development surface, but v1 does not
ask users to install arbitrary tool packages or configure raw MCP servers as the
primary way to extend agents.

Plugin settings and secrets use dedicated Runtime Plugin tables. They do not
live in generic runtime metadata, skill files, CLI config, or
environment variables. Runtime capabilities store current Plugin health
separately from the durable settings and secrets.

Plugin enablement and agent-level Plugin grants are the source of truth for
Plugin-provided agent capabilities. Users enable or disable the Plugin itself
from Settings -> Plugins, then grant it to agents from agent capability
settings. Tavern does not expose individual Plugin tool toggles.

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
secrets; widgets, the managed `merchbase` Runtime tools, and settings routes
go through the Runtime Plugin service rather than reading these tables directly.
The managed `merchbase` skill is instruction-only: it describes when to use the
tools and Rich Response, but does not expose raw Runtime API calls as the
agent contract.
