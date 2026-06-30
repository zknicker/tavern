---
summary: Skills and Tools feature for reusable agent skills, executable tools, MCP servers, and Plugin-provided capabilities.
read_when:
  - changing skill catalog, setup blockers, runtime tools, MCP servers, or agent access
  - changing how runtime-visible skills, tools, MCP servers, or Plugin capabilities become available to the agent
---

# Skills and Tools

Skills and Tools answer different questions.

* **Skills** teach the agent how to do work. They are agent-engine skill files
  or packages and are loaded on demand by Runtime.
* **Tools** let the agent do work. They are authored tool definitions, default
  tools, dynamic tools, subagent tools, or Plugin-provided tools surfaced by
  Runtime.
* **MCP** is its own settings surface. MCP servers are agent-engine connection
  records; they can expose external tools, but they are not tools themselves.
* **Channels** are places where humans can talk with Tavern agents, such as
  Tavern chat, Discord, Telegram, or another frontend.
* **Plugins** are Tavern packages that compile into bundled skills, tools,
  channels, hooks, or other Runtime capability. Users manage Plugin enablement
  from Settings -> Plugins.

## In the Box

* **Skills page.** Browse installed and available skills. Selecting a skill
  opens the rendered `SKILL.md`, enablement, source, setup status, and install
  or uninstall actions where supported.
* **Tools page.** Browse Runtime-reported tools the agent can use. Plugin tools
  are shown separately and remain controlled by Plugin enablement. Built-in
  local tools are shown as enabled read-only tools until per-agent tool grants
  are introduced.
* **MCP page.** Add, edit, test, enable, and remove MCP servers. Runtime stores
  server records and secrets, then materializes them for the agent engine.
* **Channels page.** Inspect the frontends connected to the managed agent.
  Tavern chat is always present; external channels are runtime bindings.

## Contract

Tavern should not invent a product primitive called a toolset. The agent engine
configures tools through authored files, default-tool overrides, dynamic tool
resolvers, connection records, and Plugins. Tavern can group tools for display,
but the Runtime contract should stay concrete: skills, tools, MCP servers,
channels, and Plugins.

Skill content updates are agent work. Outside Runtime-owned read-only skills,
the agent edits the skill source in place and Runtime refreshes inventory
afterward. Tavern does not own skill versioning, source merges, or a skill
marketplace.

Tool access changes are Runtime work. Runtime owns how an enabled tool becomes
available to the agent engine, whether by materializing authored tools,
disabling a default tool, resolving a dynamic tool, or installing a Plugin
contribution.

For the first multi-agent pass, Tavern gives agents the built-in local tools by
default and shows those tools as read-only. This keeps the product honest about
what agents can do without adding a premature tool-grant editor.

Provider-specific transport adapters do not create new user-visible tools. For
example, Claude Code receives Tavern tools through a generated MCP bridge
because that provider requires MCP for executable custom tools. Settings still
shows the Runtime-owned tool (`bash`, `read_file`, or a Plugin tool), not the
provider transport name (`mcp__tavern__bash`).

## Sources

| Source | Shows as | Notes |
| --- | --- | --- |
| Agent skill files | Skill | Runtime-reported skills. Includes managed, project, workspace, and installed skill packages. |
| Built-in skill library | Available skill | Optional skills vendored with the runtime and installed through Runtime. |
| Skill taps | Available skill | User-added GitHub repos with skill packages. Runtime lists, previews, scans, installs, and uninstalls them. |
| Authored tools and defaults | Tool | Executable actions available to the agent. Risk is controlled by static grants and sandbox mode. |
| Dynamic tools | Tool | Runtime- or session-resolved tools. |
| MCP servers | MCP server | Agent-engine connection records that expose external tools through MCP. Managed from Settings -> MCP. |
| Channels | Channel | Frontends that can create or continue agent sessions. Managed from Settings -> Channels. |
| Tavern Plugins | Plugin, Skill, or Tool | Plugins own enablement, then Runtime compiles their bundled skills and tools into the agent project. |

## Runtime Boundary

Runtime is the source of truth for skill inventory, tool inventory, MCP server
records, channel bindings, Plugin contributions, and agent materialization.
The app reads those records through Tavern API and renders settings. The app
does not write agent project files directly.

MCP servers are stored as Tavern Runtime records with redacted secrets. Runtime
materializes enabled MCP servers for the agent engine. Runtime then handles
tool discovery, credential use, sandboxing, and durable execution.

Plugins stay owned by Runtime. A Plugin may contribute bundled skills or tools,
but Skills and Tools pages show those as read-only reflections of the Plugin
state; direct enablement changes are rejected when the Plugin owns the row.

## Missing on Purpose

* A Tavern skill marketplace.
* A Tavern-owned skill version manager.
* A generic "toolset" product surface.
* Showing MCP servers as tools.
* Showing channels as MCP servers.
