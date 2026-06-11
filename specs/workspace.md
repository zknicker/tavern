# Workspace

Tavern owns the managed Hermes workspace it creates for Tavern agents.

The workspace is the prompt-facing home that Hermes loads for each agent
session. Hermes loads one project-context file (`AGENTS.md`) from the
workspace and `SOUL.md` from the managed Hermes home.

## Generated AGENTS.md

`AGENTS.md` is a pure generated artifact with Tavern as its single writer.
Nobody edits it: it is written read-only, opens with a generated-file banner,
and instructs the agent that the file is immutable and that `NOTES.md` is its
scratch space. It is composed deterministically from:

* **Tavern-managed content.** The agent's Tavern environment, delegation
  guidance, the Cortex/memory model, the immutability/scratch-space
  instructions, and the `tavern` skill pointer
  ([tavern-skill.md](tavern-skill.md)). Product language; does not name
  Hermes.
* **The agent name.** From the registered agent record.
* **`NOTES.md`.** Composed verbatim into a Notes section.

Composition is a pure function of its sources: identical sources produce
identical bytes, and the file is only rewritten when the composed bytes
change. Prompt-cache invalidation therefore happens exactly when a source
changes and never per turn; there is no per-turn reconcile, healing, or
managed-region merging.

## Sources

* **`NOTES.md`** (workspace) is the durable free-form source for notes,
  instructions, and conventions. The user edits it in agent settings; the
  agent edits it directly with its file tools. Tavern seeds it once —
  migrating the user/agent content of a pre-generated `AGENTS.md` so nothing
  is lost — and never writes it again.
* **`SOUL.md`** (managed Hermes home) carries identity, voice, tone, and
  durable personality. Tavern never writes it.

## Generation Triggers

Tavern regenerates `AGENTS.md` when a source may have changed:

* on agent sync (registration, rename, managed-content updates),
* when `NOTES.md` is saved through the agent file API,
* when a filesystem watch on `NOTES.md` observes a direct agent edit.

Generation failures surface at these controlled moments — never mid-turn —
and direct writes to the read-only `AGENTS.md` fail loudly at the writer.

## App Surfaces

The app exposes `NOTES.md` and `SOUL.md` as the editable agent files. The
`NOTES.md` editor offers a read-only preview of the generated `AGENTS.md`.
The app does not expose `AGENTS.md` for editing.

## Legacy

Generation clears unsupported legacy companion bootstrap files such as
`TOOLS.md`, `IDENTITY.md`, `USER.md`, `HEARTBEAT.md`, `BOOTSTRAP.md`,
`MEMORY.md`, and `ROLE.md` from the managed workspace. It does not clear
`SOUL.md`. The app does not expose those legacy files.
