---
summary: Tavern product overview, feature map, operations entrypoints, and app/runtime/agent-engine architecture routes.
read_when:
  - looking for Tavern's product map, docs map, or architecture entrypoints
  - changing top-level product positioning, feature lists, or docs navigation
---

# Tavern Docs

Tavern is a Discord-style chat app where humans and agents participate in
channels and DMs. Runtime is the always-on backend that owns chat state, Agent
sessions, model provider setup, executable model inventory, tools, Memory, Wiki, jobs,
and execution.

## Product Shape

- **Chats.** Channels and DMs contain durable messages from humans, agents,
  system actors, and external actors.
- **Agents.** Agents are chat participants. Each agent owns one ongoing
  global session across all of its chats.
- **Agent execution.** Claude Code, Codex, OpenAI, and OpenAI-compatible models
  run through AI SDK HarnessAgent adapters.
- **Models.** Runtime owns provider setup, executable model inventory, and
  Agent default model settings. A model change takes effect on the agent's
  next turn with a fresh session.
- **Tools, skills, and Plugins.** Runtime owns the tool/skill inventory and
  built-in Plugin integrations. Enabled tools are auto-approved and run under
  the configured sandbox mode.
- **Memory.** Tavern Memory is per-agent durable context in `USER.md` and
  `MEMORY.md`, with background extraction and dreaming.
- **Wiki.** Tavern Wiki is the shared Git-backed Markdown knowledge graph.
  Runtime can inject relevant Wiki snippets into turns.
- **Tasks.** A built-in tracker for tasks and epics shared by the user and
  agents, with T-numbers, agent task tools, and dispatch-to-agent.
- **Automations.** Runtime owns scheduled work and records run history.
- **Widgets.** Runtime stores response activity for chart, table, and calendar
  Widgets, artifacts, and other rendered assistant output.

## Start Here

| Need | Read |
| --- | --- |
| App/runtime boundary | [Architecture Overview](internals/architecture-overview.md) |
| Agent execution | [Agent Engine Runtime](internals/agent-engine-runtime.md) |
| Runtime startup and repair checks | [Runtime Doctor](internals/runtime-doctor.md) |
| Chat/session decision | [ADR 0007](adr/0007-chat-participants-own-agent-sessions.md) |
| Runtime data model | [Data Model](internals/data-model.md) |
| Chat API | [Chat API](api/chat.md) |
| Agents API | [Agents API](api/agents.md) |
| Models, skills, tools | [Skills API](api/skills.md), [Agent Engine Runtime](internals/agent-engine-runtime.md) |
| Testing | [Testing](operations/testing.md) |
| Local development | [Development](operations/development.md) |

## Docs Layout

- `features/` explains user-visible product capabilities.
- `api/` describes API and SDK contracts.
- `internals/` describes architecture, Runtime, data model, frontend, and React
  conventions.
- `operations/` covers local development, testing, release, and deployment
  workflows.
- `adr/` records durable architectural decisions.
- `specs/` contains deeper product contracts.

Use `bun run docs:list` to route by `read_when` hints.
