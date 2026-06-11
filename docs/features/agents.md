---
summary: Current single-agent product boundary for runtime execution, settings ownership, and synced sessions.
read_when:
  - changing how users work with the managed agent
  - changing model, tool, memory, or skill access for the managed agent
---

# Agents

Tavern currently presents one managed agent. The app does not expose an Agents
page or a sidebar Agents section.

## Current Contract

* **Single managed agent.** Tavern routes new work through the primary Runtime
  agent.
* **Hermes markdown files.** Settings exposes the Hermes-supported markdown
  files: `AGENTS.md` for managed workspace context and `SOUL.md` for the
  managed Hermes home identity. `AGENTS.md` opens with a marker-delimited
  Tavern-managed block that Runtime keeps current; everything outside the
  markers is user- and agent-owned live state and is never regenerated. The
  agent may edit both files directly with its file tools.
* **New chats.** Starting a direct chat belongs to the normal New Chat flow, not
  an agent landing page.
* **Global tools and skills.** Per-agent tool policy and per-agent skill
  assignment are not product surfaces. The managed agent receives the available
  Runtime tools and installed skills.
* **Sessions.** Synced Tavern, system, and external chats are visible from
  Settings -> Sessions with source filters.

## App surfaces

The primary app sidebar lists product areas and chats. It does not list agents.
Legacy agent URLs redirect to Settings -> Sessions. Agent configuration lives in
Settings, including workspace markdown files, model choice, model fallbacks,
subagent defaults, thinking effort, timezone, context compression, permissions,
connectors, skills, memory, sessions, and jobs.

## Runtime boundary

Hermes owns native execution. Tavern Runtime owns the managed agent record,
available capabilities, and canonical chat state. Tavern App displays the
managed agent through first-class Tavern APIs and keeps configuration surfaces
global unless a per-agent control is explicitly reintroduced.
