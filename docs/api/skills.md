---
summary: Skills API for package inspection, install/remove, setup requirements, secret bindings, updates, and per-agent enablement.
read_when:
  - changing skill install, update, secret, setup, or agent assignment APIs
  - changing how clients inspect reusable agent abilities
---

# Skills API

The Skills API is for reusable agent abilities.

Skills are inspectable packages with instructions, setup metadata, secrets,
install state, update state, and agent assignment.

## Contract

* Skill package ids are stable.
* Users can inspect the instructions an agent receives.
* Secret requirements are declared without exposing secret values.
* Setup commands and install state are visible.
* A skill can be installed without being enabled for every agent.
* Agent assignment is explicit and durable.

## Surface

The API covers:

* list available and installed skills
* get a skill package
* install or remove a skill
* read setup requirements
* read and update secret bindings
* check for updates
* enable or disable a skill for an agent

## Runtime Boundary

Tavern owns installed skill packages, secrets, and agent selections. Tavern
Runtime materializes enabled skills into the OpenClaw workspace for the selected
agent.

## Related Docs

* [Skills feature](../features/skills.md)
* [Agents API](agents.md)
* [API overview](overview.md)
