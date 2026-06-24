---
summary: Decision to make Tavern Integrations settings-managed Runtime capabilities, not agent-managed setup flows.
read_when:
  - adding or changing Integration configuration, health, settings, agent tools, or Rich Response components
---

# Integrations are settings-managed Runtime capabilities

Tavern Integrations are configured and repaired through Tavern settings, while agents may read Integration health and use read-oriented Integration actions through named Hermes toolsets only when Runtime reports the capability usable. Sync, repair, ingestion control, ripcord, account selection, secrets, and enablement stay user-managed settings or app controls rather than agent tools. Future agent-assisted setup must be a separate Tavern-wide settings approval flow, not an Integration-specific shortcut.

Integration settings and secrets use dedicated Runtime Integration tables. They do not live in generic runtime metadata, Hermes home files, skill files, CLI config, or environment variables. Runtime capabilities store current Integration health separately from the durable settings and secrets.

Integration enablement is the source of truth for Integration-provided agent
capabilities. Settings -> Skills and Settings -> Toolsets show
Integration-provided skills and toolsets in their own Integrations tabs, and
their row toggles are locked. Users enable or disable the Integration itself
from Settings -> Integrations; Tavern then reflects that state into the managed
Hermes skill and toolset when possible.

The first storage shape is:

```sql
runtime_integrations(
  id TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL,
  config_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)

runtime_integration_secrets(
  integration_id TEXT PRIMARY KEY,
  secret_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)
```

For MerchBase, `runtime_integrations.config_json` stores non-secret settings such as base URL, default account, and default marketplace. `runtime_integration_secrets.secret_json` stores the API key. API reads mask secrets; widgets, the managed `merchbase` Hermes toolset, and settings routes go through the Runtime Integration service rather than reading these tables directly. The managed `merchbase` skill is instruction-only: it describes when to use the toolset and Rich Response, but does not expose raw Runtime API calls as the agent contract.
