---
summary: Skills feature for ClawHub/GitHub installs, readable skill.md, setup, secrets, updates, per-agent enablement, and workspace materialization.
read_when:
  - changing skill install, inspection, secrets, updates, or agent assignment
  - changing how selected skills materialize into agent workspaces
---

# Skills

Skills are reusable agent abilities. The experience feels close to the Codex
app: install a skill, inspect its instructions, configure secrets, and assign it
to the agents that use it.

## In the box

* **Install from ClawHub or GitHub.** Bring in a skill package without editing
  runtime files by hand.
* **Readable `skill.md`.** Users can inspect the instructions an agent receives.
* **Secrets and setup.** Skills can declare required environment values and
  setup commands.
* **Per-agent enablement.** A skill can be available in Tavern without being
  enabled for every agent.
* **Updates.** Tavern can check installed ClawHub skills for newer versions.

## Runtime boundary

Tavern manages installed skill packages and selections. Tavern Runtime
materializes selected skills into OpenClaw agent workspaces.
