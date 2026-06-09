# Workspace

Tavern owns the managed Hermes workspace it creates for Tavern agents.

The workspace is the prompt-facing home that Hermes loads for each agent
session. Tavern exposes the Hermes-supported markdown files directly:

* `AGENTS.md` lives in the managed Hermes workspace and carries workspace
  instructions, project conventions, architecture, and operating context.
* `SOUL.md` lives in the managed Hermes home and carries identity, voice, tone,
  and durable personality. Hermes does not load `SOUL.md` from the working
  directory.

## Instruction Sources

The seeded `AGENTS.md` is assembled from three Tavern-owned sources:

* **Tavern instructions.** Repo-managed markdown that explains how a Tavern
  agent should operate inside Tavern, including Cortex tool use and workspace
  rules.
* **User-authored instructions.** The user's full agent instruction block:
  role, personality, voice, collaboration rules, output protocol, stop rules,
  and other durable behavior settings stored with the agent record.
* **Agent notes.** Agent-authored operational notes stored by Tavern and updated
  through Tavern tools.

The seeded file should read as one natural instruction document. Once a user
saves `AGENTS.md`, Runtime preserves that file as the source of truth.

## Runtime Behavior

Runtime seeds `AGENTS.md` into the managed Hermes workspace when it is missing.
Config sync must not overwrite a user-saved `AGENTS.md`.

Runtime writes `SOUL.md` to managed `HERMES_HOME` through the agent file API.
That is the location Hermes documents and loads for personality.

Runtime clears unsupported legacy companion bootstrap files such as `TOOLS.md`,
`IDENTITY.md`, `USER.md`, `HEARTBEAT.md`, `BOOTSTRAP.md`, `MEMORY.md`, and
`ROLE.md` only when the older generated-instructions path runs. It does not
clear `SOUL.md`.

User-saved `AGENTS.md` and `SOUL.md` content is source-of-truth file state.
Runtime may seed missing files but must not regenerate over saved content.

## Agent Notes

Agents do not edit user-authored markdown files directly. When an agent needs to remember a
durable operating note about itself, it uses Tavern workspace tools that update
the DB-backed agent notes source. Runtime can use those notes when seeding a
missing `AGENTS.md`.

Agent notes are for reusable operating guidance, not raw chat history, Cortex
knowledge, secrets, or user-authored instruction settings.

## App Surfaces

The Tavern app exposes `AGENTS.md` and `SOUL.md` in agent settings. They are
edited as normal Tavern settings and saved through Runtime's agent file API.

The app does not need a first-pass editor for agent-authored notes. Notes are
agent-owned and updated through Tavern workspace tools. The app may later show
them as read-only diagnostics or expose explicit user controls such as clear or
override.

The app does not expose unsupported legacy markdown files such as `TOOLS.md`,
`IDENTITY.md`, `USER.md`, `MEMORY.md`, or `ROLE.md`.

## Tavern Workspace Plugin

The first-party Hermes plugin `tavern-workspace` owns managed workspace policy.

It owns:

* agent notes read and update tools
* generated workspace-file protection hooks
* instruction-source status exposed to agents or operators
* future Tavern-managed workspace files when those files are generated or
  policy-owned by Tavern

It does not own chat delivery, Cortex recall/capture/search, skills, model
settings, or Hermes runtime config.

The plugin blocks direct tool writes to generated workspace files when Hermes
can identify the target path. Runtime regeneration remains the backstop for
missed or out-of-band edits.
