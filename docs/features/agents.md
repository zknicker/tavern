---
read_when:
  - changing how users configure or work with agents
  - changing model, tool, memory, or skill controls for agents
---

# Agents

Agents are the named workers in Tavern. They own the user-facing personality,
model choices, tool policy, memory behavior, and skill selection.

## In the box

* **Named agents.** One app can manage multiple workers for different jobs.
* **Model choices.** Tavern projects the runtime's available model surface into
  app settings.
* **Tool policy.** Users can inspect what an agent is allowed to use.
* **Skill assignment.** Installed skills can be enabled per agent.

## Runtime boundary

OpenClaw owns native execution. Tavern owns agent-facing app records, controls,
and the chat state where agents participate.
