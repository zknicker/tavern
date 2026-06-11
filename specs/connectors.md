# Connectors

Connectors are user-configured MCP servers that extend what the agent can do
with external tools.

## Product Expectations

- A person can add, edit, test, and remove connectors in Settings without
  editing runtime config files.
- A connector has a stable user-facing name, a transport (local command or
  remote URL), and optional environment values, headers, and timeout.
- Each connector shows health: configured, connected, or failing with a
  diagnostic the user can act on.
- Connector secrets are entered once and stored safely; they are never shown
  back in full or persisted in plaintext app storage.
- Adding or changing a connector takes effect without the user manually
  restarting anything; when a restart is unavoidable, Tavern surfaces a
  pending state and handles it.

## Ownership

- Tavern Runtime is canonical for connector records. Secrets live in Tavern
  Vault; generated managed runtime config and environment receive only the
  materialized values the engine needs.
- Hermes executes connector tools. Tavern does not proxy or reimplement tool
  calls.
- Connector tools surface to the agent through the existing runtime toolset
  model ([skills.md](skills.md)); a connector is a configuration record, not a
  separate kind of toolset row.
- Connector health is a Runtime capability so app surfaces and the agent can
  gate behavior on it.

## UI

- `Settings -> Connectors` lists connectors as unified card rows with health,
  plus add/edit/delete and a test action.
- The form exposes name, transport, command/args or URL, environment values,
  headers, and timeout. Secret-valued fields are write-only.
