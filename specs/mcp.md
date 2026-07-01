# Advanced MCP Servers

MCP servers are advanced agent-engine connection records that can expose
external tools. Tavern's normal user-facing integration surface is built-in
Plugins; direct MCP server setup is retained for Runtime development and
Plugin-backed experiments.

## Product Expectations

- A developer or advanced user can add, edit, test, enable, disable, and remove
  MCP servers in Settings without editing generated agent project files.
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

- `Settings -> MCP` is an advanced page that lists MCP servers as rows with
  health, transport, and actions.
- The page may include a curated MCP catalog, but custom command/URL servers
  are not the default product extension path.
- MCP servers do not appear in `Settings -> Channels`.
- MCP servers do not create a user-facing Tools page. Runtime may still report
  concrete MCP-backed tools as diagnostics.
