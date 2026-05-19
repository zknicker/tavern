# Workspace

Tavern owns the managed OpenClaw workspace it creates for Tavern agents.

The workspace is the prompt-facing home that OpenClaw loads for each agent
session. Tavern keeps that surface simple: managed agents receive one generated
`AGENTS.md` file instead of spreading stable instructions across `SOUL.md`,
`TOOLS.md`, `MEMORY.md`, and other OpenClaw bootstrap files.

## Instruction Sources

The generated `AGENTS.md` is assembled from three Tavern-owned sources:

* **Tavern instructions.** Repo-managed markdown that explains how a Tavern
  agent should operate inside Tavern, including Cortex tool use and workspace
  rules.
* **Agent soul.** User-authored personality, voice, role, and durable behavior
  settings stored with the agent record.
* **Agent notes.** Agent-authored operational notes stored by Tavern and updated
  through Tavern tools.

The rendered file should read as one natural instruction document. Section
boundaries are storage and ownership concerns; they should not make the prompt
feel like a generated template.

## Runtime Behavior

Runtime writes the generated `AGENTS.md` into the managed OpenClaw workspace on
boot, config sync, and instruction source changes.

Runtime leaves the other OpenClaw bootstrap markdown files blank or unused for
managed Tavern agents. OpenClaw may still support those files, but Tavern does
not rely on them for managed agent behavior.

The generated file is not the source of truth. If it is missing, stale, or
modified, Runtime regenerates it from the separate Tavern sources.

## Agent Notes

Agents do not edit `AGENTS.md` directly. When an agent needs to remember a
durable operating note about itself, it uses Tavern workspace tools that update
the DB-backed agent notes source. Runtime then renders those notes into the next
generated `AGENTS.md`.

Agent notes are for reusable operating guidance, not raw chat history, Cortex
knowledge, secrets, or user personality settings.

## App Surfaces

The Tavern app exposes the user-authored soul/personality in agent settings. It
is edited as a normal Tavern setting and saved to Tavern storage.

The app does not need a first-pass editor for agent-authored notes. Notes are
agent-owned and updated through Tavern workspace tools. The app may later show
them as read-only diagnostics or expose explicit user controls such as clear or
override.

Generated `AGENTS.md` is not edited in the app as a normal agent file. If the
app shows it, it should be read-only with status such as last rendered time,
rendered hash, and whether Runtime believes the workspace file is current.

## Tavern Workspace Plugin

The first-party OpenClaw plugin `tavern-workspace` owns managed workspace policy.

It owns:

* agent notes read and update tools
* generated workspace-file protection hooks
* instruction-source status exposed to agents or operators
* future Tavern-managed workspace files when those files are generated or
  policy-owned by Tavern

It does not own chat delivery, Cortex recall/capture/search, skills, model
settings, or OpenClaw runtime config.

The plugin blocks direct tool writes to generated workspace files when OpenClaw
can identify the target path. Runtime regeneration remains the backstop for
missed or out-of-band edits.
