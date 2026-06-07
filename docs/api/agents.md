---
summary: Agent records and configuration API for model choices, tool policy, memory policy, skill assignment, and runtime metadata boundaries.
read_when:
  - changing agent records, instructions, personality, model settings, tool policy, or per-agent skill and memory controls
  - changing how clients list, configure, or address agents
---

# Agents API

The Agents API is for the workers users configure and talk to in Tavern.

Agents are client-facing records. Runtime sessions and OpenClaw execution details
can be attached as metadata, but the API exposes agents as named Tavern workers
with user-authored instructions, model, tool, memory, and skill policy.

## Contract

* Agent ids are durable Tavern ids hosted by Tavern Runtime.
* Agent list and detail reads use synced Runtime records. Mounting an app screen
  must not contact OpenClaw Gateway or enqueue a background sync job just to
  discover agents.
* Agent records expose display name, description, user-authored instructions,
  model policy, tool policy, memory policy, skill selections, and availability.
* Model availability comes from Runtime capabilities and config reads. Clients
  read it through agent and model capabilities.
* Tool and skill controls are inspectable before a run starts.
* Settings exposes each managed OpenClaw workspace markdown file directly:
  `AGENTS.md`, `SOUL.md`, `TOOLS.md`, `IDENTITY.md`, and `USER.md`.
  These files are workspace state, not agent profile fields.
* Tavern policy includes Cortex brain-first lookup guidance. Managed agents
  check Cortex before external lookup when durable user, project, or prior
  decision context may already exist.
* OpenClaw-backed settings use narrow domain mutations. Clients update agent
  name, model, thinking default, and messaging bindings through agent and
  messaging APIs instead of editing or saving OpenClaw config JSON.
* Runtime execution state is not required just to list agents.

## Surface

The API covers:

* list agents
* get an agent
* list an agent's Tavern and external runtime chat references
* create or update agent settings
* read and update user-authored instructions
* read model choices and availability
* read and update tool policy
* read and update memory policy
* read and update skill assignment
* read and update managed workspace markdown files
* read workspace instruction status when exposed for diagnostics

## Runtime Boundary

OpenClaw owns native execution, tool invocation, model calls, files, and
sessions. Tavern Runtime owns the first-class agent records, user-editable
agent controls, and the chat state where agents participate. Tavern App reads
those records through tRPC/React Query and may keep app-owned presentation
overlays, but the app database is not the source of truth for agent existence.

Runtime words such as `session`, `turn`, and `run` appear only where the API is
returning execution metadata for a specific agent activity.

`agent.chats.list` is the agent-scoped chat inventory for agent pages. It
combines Tavern chats bound to the agent with Runtime-owned OpenClaw chat
references such as Discord channels. OpenClaw chat references are read-only
evidence surfaces; they do not appear in the global Tavern sidebar chat list.

## Related Docs

* [Agents feature](../features/agents.md)
* [API overview](overview.md)
* [Tavern Runtime](../internals/runtime.md)
