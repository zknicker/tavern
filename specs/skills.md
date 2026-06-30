# Skills and Tools

Skills are reusable instruction packages. Tools are executable agent actions.
MCP servers are agent-engine connection records. Channels are chat frontends.

## Product Expectations

- A skill has a stable Runtime source identity.
- A skill contains instructions and may include supporting files such as
  scripts, references, or assets.
- Tavern shows Runtime-visible skills without owning their filesystem
  lifecycle.
- A tool has a stable Runtime-native name.
- Product-facing skill and tool selection applies to the agent.
- Selecting a skill affects only the agent's skill access.
- Enabling a tool affects only Runtime's agent tool materialization.
- Plugins may provide tools, workflows, providers, channels, hooks, or skills.
  Tavern presents only the concrete Plugin-owned surfaces.
- MCP servers are not tools. They are connection records that may expose tools.
- Channels are not MCP servers. They are places where humans can talk with
  Tavern agents.

## Ownership

- Tavern Runtime is canonical for the managed agent's skill, tool, MCP,
  channel, and Plugin state.
- Runtime remains canonical for execution behavior: prompt loading, tool
  calling, connection tools, sandboxing, durable turns, and replay.
- Runtime-discovered skills remain owned by their source location.
- Runtime-discovered tools remain owned by Runtime materialization.
- Runtime owns MCP server records and secrets, then materializes enabled MCP
  servers for the agent engine.
- Plugins own their contributed skills and tools. Direct enablement changes
  from Skills or Tools are rejected when Plugin enablement owns the row.

## Source Model

### Skill Sources

Runtime reports skill files and packages from the active agent project and
managed skill locations. Tavern should show the inventory Runtime reports and
should not copy Runtime skills into an app-owned store.

### Tool Sources

Runtime reports tools from the active agent project:

1. authored tools
2. agent-engine default tools that remain enabled
3. dynamic tools resolved by Runtime
4. subagent tools
5. connection tools surfaced from MCP servers
6. Plugin-provided tools compiled into the agent project

Tavern may group tools visually, but it should not name that grouping as an
agent-engine primitive.

### MCP Sources

Settings -> MCP manages MCP server records. A server may use command or URL
transport, optional env/header secrets, enablement, and health checks. Runtime
stores secrets redacted and materializes enabled records for the agent engine.

### Channel Sources

Settings -> Channels manages frontend bindings for Tavern agents. Tavern chat
is built in. Discord, Telegram, Slack, SDK, and other frontends are separate
channels with their own session bindings.

## UI Model

- Skills and Tools are separate settings pages.
- The Skills page has Installed and Available views.
- The Tools page lists Runtime-visible tools, including Plugin tools in a
  distinct view.
- The MCP page lists MCP servers and MCP catalog entries.
- The Channels page lists Tavern and external frontend bindings.
- Skill rows open the skill detail surface.
- Tool rows expose enablement, usability, setup diagnostics, and any Runtime
  supported setup action.
- MCP rows expose server transport, health, test, edit, enable, and delete
  actions.
- Plugin-owned rows are visibly Plugin-owned and locked to Plugin enablement.

## Usability State

Tavern keeps product state small:

| State | Meaning |
| --- | --- |
| `enabled` | The user wants the agent to use the skill or tool. |
| `disabled` | The user does not want the agent to use the skill or tool. |
| `not_usable` | The item is enabled, but Runtime reports that the agent cannot currently use it. |

Runtime diagnostic text can explain missing setup, auth, dependencies,
restart, stale inventory, or policy failures. Tavern should display useful text
without inventing a second taxonomy.

## Failure Behavior

- If Runtime inventory fails, settings should keep the last observed records
  visible when available and mark current usability as unknown.
- Missing dependencies do not remove an item.
- Unsupported tool mutations fail through Runtime and leave the visible record
  intact.
- MCP test failures are shown on the MCP row or dialog and do not remove the
  server record.
