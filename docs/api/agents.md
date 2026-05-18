---
read_when:
  - changing agent records, model settings, tool policy, or per-agent skill and memory controls
  - changing how clients list, configure, or address agents
---

# Agents API

The Agents API is for the workers users configure and talk to in Tavern.

Agents are client-facing records. Runtime sessions and OpenClaw execution details
can be attached as metadata, but the API exposes agents as named Tavern workers
with model, tool, memory, and skill policy.

## Contract

* Agent ids are durable Tavern ids.
* Agent records expose display name, description, model policy, tool policy,
  memory policy, skill selections, and availability.
* Model availability comes from runtime projection, but app clients read it
  through agent and model capabilities.
* Tool and skill controls are inspectable before a run starts.
* Runtime execution state is not required just to list or edit agents.

## Surface

The API covers:

* list agents
* get an agent
* create or update agent settings
* read model choices and availability
* read and update tool policy
* read and update memory policy
* read and update skill assignment

## Runtime Boundary

OpenClaw owns native execution, tool invocation, model calls, files, and
sessions. Tavern owns agent-facing app records, controls users edit, and the
chat state where agents participate.

Runtime words such as `session`, `turn`, and `run` appear only where the API is
returning execution metadata for a specific agent activity.

## Related Docs

* [Agents feature](../features/agents.md)
* [API overview](overview.md)
* [Tavern Runtime](../internals/runtime.md)
