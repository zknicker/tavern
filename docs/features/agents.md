---
summary: User-facing agent controls for named workers, model choices, tool policy, skill assignment, and the OpenClaw execution boundary.
read_when:
  - changing how users configure or work with agents
  - changing model, tool, memory, or skill controls for agents
---

# Agents

Agents are the named workers in Tavern. Tavern Runtime hosts their records and
user-editable controls: personality, model choices, tool policy, memory
behavior, and skill selection.

## In the box

* **Named agents.** One app can manage multiple workers for different jobs.
* **Personality.** Users can edit an agent's soul: its voice, role, and stable
  behavior.
* **Generated instructions.** Tavern renders the agent's runtime instructions
  from Tavern policy, user-authored personality, and agent-authored notes.
* **Model choices.** Tavern reads Runtime model capabilities and config for app
  settings.
* **Tool policy.** Users can inspect what an agent is allowed to use.
* **Skill assignment.** Installed skills can be enabled per agent.

## App surfaces

The agent settings UI includes an Instructions or Personality section with a
plain textarea for the user-authored soul/personality. Save and discard controls
write the DB-backed agent setting; the UI does not write OpenClaw workspace
files directly.

Agent-authored notes do not need a first-pass editing UI. They are agent-owned
operating notes updated through Tavern workspace tools and rendered into the
generated instructions.

Generated `AGENTS.md` may be shown later as read-only preview or diagnostics.
If Tavern exposes OpenClaw agent files, generated instruction files should be
read-only or hidden from normal editing.

## Runtime boundary

OpenClaw owns native execution. Tavern Runtime owns agent-facing records,
controls, and the chat state where agents participate. Tavern App displays and
edits agents through first-class Tavern APIs instead of treating OpenClaw as an
app-facing read backend.

Tavern renders each managed agent's `AGENTS.md` from separate instruction
sources: Tavern-managed operating instructions, the user-authored soul, and
agent-authored notes. Users edit soul/personality in Tavern settings. Agents
update their own notes through Tavern workspace tools.
