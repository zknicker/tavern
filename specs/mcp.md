# MCP Servers

MCP servers are user-configured agent-engine connection records that extend
what the agent can do by exposing external tools.

## Product Expectations

- A person can add, edit, test, enable, disable, and remove MCP servers in
  Settings without editing generated agent project files.
- An MCP server has a stable user-facing name, a transport (`command` or
  `url`), and optional env/header secrets.
- Each MCP server shows health: configured, connected, or failing with a
  Runtime-provided reason.
- Secrets are entered once and stored safely; they are never shown again.
- Adding or changing an MCP server takes effect through Runtime agent
  materialization.

## Ownership

- Tavern Runtime is canonical for MCP server records.
- Runtime executes MCP connection tools through the agent engine. Tavern does
  not proxy or reimplement tool calls.
- MCP tools surface through the Runtime tool inventory. An MCP server is a
  configuration record, not a tool row.
- MCP health is a Runtime capability so app surfaces and the agent can explain
  degraded setup.

## UI Model

- `Settings -> MCP` lists MCP servers as rows with health, transport, and
  actions.
- The page may include a curated MCP catalog, but custom command/URL servers
  remain first-class.
- MCP servers do not appear in `Settings -> Channels`.
- MCP servers do not appear in `Settings -> Tools` unless Runtime reports the
  concrete tools they expose.
