# Plugins

Plugins are Tavern-managed integrations with external systems. Runtime owns Plugin settings,
secrets, health, service enablement, agent grants, and agent-facing tools. Agents do not run setup
or credential flows from chat.

## Model

A `Plugin` is the product integration container. Examples: `merchbase`, `google`.

A `Service` is a configurable capability inside a Plugin. Examples: `google.calendar`,
`google.drive`. Every Plugin declares at least one Service. Single-capability Plugins such as
MerchBase still use one Service so Plugin projection has one shape.

A `Connection` is Plugin-level account or credential state. OAuth tokens, API keys, account email,
granted scopes, and expiry belong to the Plugin connection, not to a Service.

A `Grant` is per-agent permission to use a Plugin. In v1, grants are Plugin-level. If a Plugin has
multiple enabled Services, a granted agent may use the enabled Services for that Plugin. Per-agent
per-Service grants are a future extension, not the current product contract.

`Health` is Runtime status for a Plugin or Service. Health informs Settings and diagnostics. Tool
exposure is based on stored enablement, connection presence, granted scopes, and agent grants; live
health checks do not make tools appear and disappear during transient upstream failures.

## Storage

Plugin records stay in the existing Runtime Plugin tables.

- `runtime_plugins.enabled` is the operator's global Plugin toggle.
- `runtime_plugins.config_json` stores non-secret Plugin config and Service enablement.
- `runtime_plugin_secrets.secret_json` stores Plugin credentials and OAuth tokens.
- `agent_plugin_grants` stores per-agent Plugin grants.

For a multi-Service OAuth Plugin such as Google, `config_json` stores service enablement:

```json
{
  "services": {
    "calendar": { "enabled": true },
    "drive": { "enabled": false }
  }
}
```

OAuth token state stays in `secret_json`:

```json
{
  "oauth": {
    "accessToken": "...",
    "refreshToken": "...",
    "expiresAt": "2026-07-05T19:00:00.000Z",
    "grantedScopes": ["openid", "email", "https://www.googleapis.com/auth/calendar.events"],
    "tokenType": "Bearer",
    "account": { "email": "user@example.com", "subject": "..." }
  }
}
```

Secrets are plain SQLite JSON for now. Runtime keeps token reads and refreshes behind Plugin helper
APIs so encrypted storage can replace the backing store later without changing Plugin tools.

## Manifest

Every Plugin manifest declares `services[]`.

Plugin-level fields declare container metadata, global settings, write-only secrets, optional
connection auth, Plugin-level health, and Widget ownership. Service-level fields declare
Service metadata, required OAuth scopes, health capabilities, skills, and tool groups.

MerchBase is a one-Service Plugin. Google is a multi-Service Plugin whose first Service is
Calendar.

## OAuth

OAuth is a reusable Runtime helper for Plugins, not a Google-specific chat flow. An OAuth Plugin
declares provider metadata in its manifest. Runtime starts a PKCE loopback flow from Settings,
stores tokens in `runtime_plugin_secrets`, refreshes tokens before tool calls, and records granted
scopes.

Tavern-owned OAuth clients are infrastructure config. For Google, Runtime reads the desktop
client id and installed-app client secret from Tavern development environment variables or the
generated `runtime-assets/google/oauth-client.json` file shipped inside the Runtime release
tarball. The values stay out of source control and the Homebrew tap. Users connect their account
in Settings but do not configure a Google Cloud OAuth app.

When the user enables a Service whose scopes are not already granted, Settings reconnects the
Plugin with the expanded scope set. Agents see only the resulting tools after the operator completes
the settings flow.

## Exposure

Runtime exposes a Service's Plugin-owned skills and tools to an agent only when:

- the Plugin is globally enabled,
- the Service is enabled,
- the Plugin connection exists when the Plugin requires one,
- the Service's required scopes are granted when the Plugin uses OAuth,
- and the agent has the Plugin grant.

Runtime routes still reject unavailable Plugin actions defensively.
