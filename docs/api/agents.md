---
summary: Agent records and configuration API for model choices, memory policy, skill assignment, Plugin grants, and runtime metadata boundaries.
read_when:
  - changing agent records, instructions, personality, model settings, Plugin grants, or per-agent skill and memory controls
  - changing how clients list, configure, or address agents
---

# Agents API

The Agents API is for the workers users configure and talk to in Tavern.

Agents are client-facing records. Runtime sessions and execution details
can be attached as metadata, but the API exposes agents as named Tavern workers
with instruction files, model, execution, memory, skill assignment, and Plugin
grant policy.

## Contract

* Agent ids are durable Tavern ids hosted by Tavern Runtime.
* Runtime bootstraps `agt_primary`, and clients can create, list, configure,
  and address additional agents.
* Each Runtime-managed agent owns one built-in Tavern DM with the local human
  operator. Clients reuse that DM instead of creating additional direct chats
  for the same agent.
* Agent list and detail reads use synced Runtime records. Mounting an app screen
  must not contact the agent runtime or enqueue a background sync job just to
  discover agents.
* Agent records expose display name, model policy, memory policy, skill
  selections, Plugin grants, workspace folder, and availability.
* Agent appearance is app-owned presentation stored in the agent profile:
  a primary color and a character (`knight`, `penguin`, `cat`, `dog`, `robot`,
  `ghost`, or `cloud`). The catalog returns `character`, `effectiveCharacter`,
  and `defaultCharacter` alongside the color fields; a null character resolves
  to a stable default derived from the agent id. Color is a name label only and
  does not tint the avatar.
* Skill selections are ids of installed Runtime skills. Runtime resolves those
  ids during execution and passes the matching skill bundles through the AI SDK
  skill surface for executors that support it. Skill content is not appended to
  the agent instruction text.
* Model availability comes from model options exposed through Runtime.
  Clients read the stored snapshot and capability state instead of maintaining a
  Tavern-maintained list.
* Model records include the Runtime execution kind. All supported agent model
  rows execute through the harness route; OpenAI API-key rows use the Pi
  harness adapter.
* Skill assignments and Plugin grants are inspectable before a run starts.
  Harness tools are executor facts governed by sandbox and approval policy, not
  per-agent grants.
* Instruction settings use markdown source files. Runtime composes the system
  prompt from Tavern-managed instruction text plus workspace-editable
  `SOUL.md` and `NOTES.md`; it does not materialize a generated `AGENTS.md`
  file in the workspace. Clients save source files through the Runtime-hosted
  agent file API. The rendered system prompt is readable for preview through
  the instructions read surface.
* Tavern policy includes Memory-first lookup guidance. Managed agents
  check Memory before external lookup when durable user, project, or prior
  decision context may already exist.
* Agent settings use narrow domain mutations. Clients update agent
  name, model, thinking default, and messaging bindings through agent and
  messaging APIs instead of editing or saving raw engine config JSON.
* Persisted agent settings mean user intent. Runtime startup can apply Tavern
  defaults to the managed engine, but it must not write those defaults into the
  saved agent settings store.
* Agent environment variables are Runtime-stored secrets exposed to the local
  settings UI. The home timezone is a runtime-wide setting, not an agent
  setting. Model fallback chains, web page summarizer models, context
  compression, and subagent defaults are intentionally not exposed until the
  local agent engine supports them.
* Runtime execution state is not required just to list agents.

## Surface

The API covers:

* list agents
* get an agent
* list an agent's Tavern and external runtime chat references
* create agents
* delete agents
* update agent settings
* read and update supported agent markdown files
* read model choices and availability
* read and update agent environment variables
* read and update memory policy
* read and update skill assignment
* read and update agent Plugin grants
* read generated instruction status when exposed for diagnostics

## Runtime Boundary

Tavern Runtime owns native execution, tool invocation, model calls, files, and
sessions. Runtime also owns the first-class agent records, user-editable
agent controls, and the chat state where agents participate. Tavern App reads
those records through tRPC/React Query and may keep app-owned presentation
overlays, but the app database is not the source of truth for agent existence.
When a client creates an agent without a workspace folder, Runtime assigns the
workspace under its data root.

Runtime words such as `session`, `turn`, and `run` appear only where the API is
returning execution metadata for a specific agent activity.

`agent.chats.list` is the agent-scoped chat inventory for agent pages. It
combines Tavern chats bound to the agent with Runtime-owned external chat
references such as Discord channels. External chat references are read-only
evidence surfaces; they do not appear in the global Tavern sidebar chat list.

## Related Docs

* [Agents feature](../features/agents.md)
* [API overview](overview.md)
* [Tavern Runtime](../internals/runtime.md)
