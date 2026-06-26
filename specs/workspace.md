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
  guidance, the Memory model, Workspace/workbench rules, generated-file
  instructions, skill-maintenance guidance, and the `tavern` skill pointer
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
  agent edits it directly with its file tools. For a new workspace, Tavern
  seeds it as an empty file. When migrating a pre-generated `AGENTS.md`,
  Tavern seeds it once with the old user/agent content so nothing is lost, and
  never writes it again.
* **`SOUL.md`** (managed Hermes home) carries identity, voice, tone, and
  durable personality. Tavern never writes it.
* **`workbench/`** (workspace) is the user-visible Workspace directory. Agents
  use it for durable files, projects, code, experiments, assets, and other
  working artifacts that are not Memory.

Fresh Hermes homes seed `SOUL.md`; they do not seed a default workspace
`AGENTS.md`. Tavern's generated `AGENTS.md` is therefore Tavern's managed
workspace context, not a copied upstream default.

The generated skill-maintenance guidance tells agents to inspect the current
skill catalog before adding or updating skills, then use native skill tools to
read, create, or patch the smallest durable skill. For external skill search,
it uses `hermes skills search <query> --source skills-sh` unless the user names
a different source.

## Inspectable Outputs

The generated instructions tell agents to link inspectable outputs in final
replies: workspace files, Memory files, Markdown or HTML documents, images, and
generated assets. The rule is intentionally short so it can live in the
high-priority managed prompt without crowding the user's notes.

Agents prefer canonical Markdown links returned by tools. When a tool does not
return a link, agents use Tavern internal links:

| Target | Link form |
| --- | --- |
| Workspace file or asset | `[name](tavern://workspace/path)` |
| Memory file | `[name](tavern://vault/path)` |

These links are presentation hints for Tavern App. The final answer cites the
thing the agent created or changed; it does not mention the Artifact Panel or
ask the user to open a special surface.

The `tavern://` scheme is internal to Tavern. It is not a filesystem path,
external URL, or engine-owned protocol. The app renderer contract is to resolve
it into an Artifact Panel target with the current runtime scope and load the
target through Tavern APIs. Implementations must not treat bare absolute paths
as the cross-machine contract.

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

The app's Workspace surface exposes `workbench/`, not the managed workspace
root. The workspace root can still contain generated instructions, runtime
state, and legacy cleanup files; those are not the user's browsing surface.

Knowledge belongs in Memory, not `workbench/`. Operating instructions belong
in `NOTES.md` or `SOUL.md`, not `workbench/`.

## Legacy

Generation clears unsupported legacy companion bootstrap files such as
`TOOLS.md`, `IDENTITY.md`, `USER.md`, `HEARTBEAT.md`, `BOOTSTRAP.md`,
`MEMORY.md`, and `ROLE.md` from the managed workspace. It does not clear
`SOUL.md`. The app does not expose the legacy workspace-root files.
