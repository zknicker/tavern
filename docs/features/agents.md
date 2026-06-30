---
summary: Current agent product boundary for Runtime-managed agents, settings ownership, and synced sessions.
read_when:
  - changing how users work with the managed agent
  - changing model, tool, memory, or skill access for the managed agent
---

# Agents

Tavern Runtime supports multiple managed agents. Tavern App exposes a compact
Settings -> Agent list/create/edit surface while the main chat UI can continue
to feel primary-agent-first.

## Current Contract

* **Bootstrapped agent.** Tavern bootstraps `agt_primary` so a fresh Runtime is
  immediately useful.
* **Runtime-managed agent records.** Runtime can store multiple agents with
  independent names, enabled skill ids, model choices, and workspace folders.
  Settings -> Agent lists those agents, creates new agents, and edits the
  selected agent's display name, color, model, thinking default, timezone, and
  environment variables.
* **Instruction files.** `AGENTS.md` is a generated, read-only artifact that
  Runtime composes from its sources; nobody edits it. Settings exposes the
  sources: `NOTES.md` for durable notes and instructions (with a preview of
  the generated `AGENTS.md`) and `SOUL.md` for identity and personality. The
  agent edits both source files directly with its file tools.
* **New chats.** Starting a direct chat belongs to the normal New Chat flow, not
  an agent landing page.
* **Agent tools and skills.** Runtime stores per-agent enabled skill ids.
  Built-in tools are currently all enabled and read-only; per-agent tool grants
  can layer on later.
* **Sessions.** Synced Tavern, system, and external chats are visible from
  Settings -> Sessions with source filters.

## App surfaces

The primary app sidebar lists product areas and chats. It does not list agents.
Agent configuration lives in Settings, including the agent picker, display
name, color, notes and personality files, model choice, thinking effort,
timezone, agent environment variables, channels, MCP servers, skills, Memory,
sessions, and jobs. Model fallbacks, web page summarizer model, context
compression, permission prompts, and subagent model defaults are not settings
surfaces until the local agent engine supports them.

## Runtime boundary

Tavern Runtime owns local agent execution, managed agent records, available
capabilities, and canonical chat state. Tavern App creates and edits agents
through first-class Tavern APIs; it does not write agent engine files or choose
runtime workspace paths.
