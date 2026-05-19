---
summary: Skills & Plugins API for skill inspection, runtime plugin usability, setup requirements, secret bindings, and agent enablement.
read_when:
  - changing skill inspection, secret, setup, runtime plugin, or agent access APIs
  - changing how clients inspect reusable agent abilities and runtime access
---

# Skills & Plugins API

The Skills & Plugins API backs the Skills & Plugins page. It exposes reusable
instruction packages and the runtime plugins an agent can use.

Skills are inspectable runtime-visible instruction packages with setup metadata,
secrets, source state, and agent enablement.

Plugins are runtime-backed capabilities such as OpenClaw plugins, native Codex
plugins, Computer Use, and compatible workflow plugins. They are not skill rows
unless the runtime exposes them as skills with instructions.

## Contract

* Skill ids are stable within their runtime source.
* Users can inspect the instructions an agent receives.
* Secret requirements are declared without exposing secret values.
* Setup requirements and source state are visible.
* A skill can be visible without being enabled for the agent.
* Agent enablement is explicit and durable.
* Plugin ids are stable within their source runtime and include source metadata.
* Plugin usability separates the user's enablement choice from whether the
  runtime currently reports the plugin as usable.
* Runtime plugin details are exposed as metadata for diagnostics, not as the
  primary product model.

## Surface

The API covers:

* list visible skills
* get a skill
* read setup requirements
* read and update secret bindings
* enable or disable a skill for the agent
* list runtime plugins visible to Tavern
* enable or disable a supported plugin for the agent
* read runtime-provided usability and diagnostic text

## Runtime Boundary

Tavern owns skill secrets and agent access choices. The runtime owns skill and
plugin discovery, eligibility, and execution.

Plugins remain runtime-owned. Tavern stores the user's enablement choice and
projects supported plugin config into managed runtime config. For native Codex
plugins, Tavern should use Codex app-server inventory and OpenClaw Codex harness
config rather than copying plugin code into the Tavern skill store.

## Related Docs

* [Skills & Plugins feature](../features/skills.md)
* [Agents API](agents.md)
* [API overview](overview.md)
