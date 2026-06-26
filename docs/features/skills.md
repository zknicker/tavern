---
summary: Skills & Toolsets feature for reusable agent instructions, Hermes tool groups, usability, and agent access.
read_when:
  - changing skill catalog, toolset catalog, setup blockers, runtime toolsets, or agent access
  - changing how runtime-visible skills or toolsets become available to the agent
---

# Skills & Toolsets

The Skills and Toolsets settings pages are where users manage what the agent
can use from the runtime-managed Hermes instance.

## In the box

* **Skills page.** A full-height file-tree browser groups installed skills,
  Plugin skills, tap skills, and the built-in library. The tree is the settings
  page sidebar. Each skill exposes a `SKILL.md` file in the tree; selecting it
  opens the rendered preview beside the tree.
* **Skill preview.** One detail surface for installed and available skills: the
  rendered `SKILL.md`, the enable toggle, the security scan verdict, Install
  for available skills, and Uninstall for hub-installed skills.
* **Manage sources.** A dialog on the Skills page that adds and removes tap
  repos. Removing a repo never uninstalls skills installed from it.
* **Toolsets page.** Enable or disable user-managed Hermes tool groups such as
  browser, file, MCP, or provider-backed tools, with the Add toolset dialog
  (curated MCP catalog plus custom HTTP/stdio servers) and the Set up dialog
  (the engine's provider matrix: pick a provider, save keys, run the install
  step).
* **Toolsets page, Plugins tab.** Plugin-provided toolsets. These rows show
  what a Plugin contributes to the agent, but enablement is locked to Settings
  -> Plugins.

## Contract

Skills teach the agent how to do work. Toolsets grant access to groups of tools
Hermes can execute. Some plugins may provide tools or skills, but Tavern does not
show a separate plugin catalog here unless Hermes exposes a concrete skill or
toolset for it.

The page shows skills and toolsets together because both answer "what can the
agent do?" Rows must still make the type clear.

Skill content updates follow Hermes's procedural-memory model. Outside
Runtime-owned read-only skills, updating a skill is agent work: the agent reads
the installed skill and its source material, applies a targeted patch or merge
in the source location, and reports the result. Tavern does not model skill
versions or merge conflicts as settings state.
The managed workspace instructions tell agents to inspect the current skill
catalog first, then use native skill tools to load, create, or patch the
smallest durable skill. For external skill search, agents use
`hermes skills search <query> --source skills-sh` unless the user names a
different source.

## Sources

| Source | Shows as | Notes |
| --- | --- | --- |
| Hermes skill folders | Skill | Includes runtime-reported workspace, project, personal, managed/local, and configured extra skill folders. Managed Runtime config blocks bundled skill prompt eligibility with a sentinel `skills.allowBundled` allowlist. |
| Built-in library | Installable skill | The engine's vendored `optional-skills/` directory: official, vendor-maintained skills that are not activated by default. Runtime lists it from the resolved engine install; installs land in the engine's skill folders and then appear as normal skill rows. |
| Hub taps | Installable skill | User-added GitHub repos with a `skills/<name>/SKILL.md` layout, managed from the Sources tab. Runtime writes the engine's `skills/.hub/taps.json` and lists tap repos itself through the GitHub contents API. Private repos work when Runtime resolves a GitHub token (`GITHUB_TOKEN`/`GH_TOKEN` or `gh auth token`). |
| Hermes toolsets | Toolset | Runtime-owned groups returned by Hermes `/api/tools/toolsets`; enablement is sent back to Hermes. Setup flows through the engine provider matrix. |
| MCP servers | Toolset source | Curated catalog installs and custom HTTP/stdio servers managed from the Add toolset dialog. |
| Hermes plugins | Skill or toolset when exposed | Hermes plugin packages can register tools, workflows, providers, and plugin-owned skills. Tavern shows the agent-facing skill or toolset, not the plugin package as a separate product row. |

Platform connections are separate. Discord, Slack, and similar messaging places
where an agent exists remain platform connections; their routing rules remain
bindings.

## Usability

Rows should stay simple:

| State | Meaning |
| --- | --- |
| Enabled | The item is enabled and Runtime reports no setup blockers. |
| Off | The skill or toolset is disabled for new sessions. |
| Needs setup | The runtime reports missing tools or config. |
| Unknown | Runtime setup status is unknown. |

Tavern should show runtime-provided reason text when it has it, especially for
setup blockers such as missing binaries, environment values, or config paths.
It should not turn every setup, auth, dependency, reload, policy, or inventory
edge case into a separate product state.

## Runtime Boundary

Tavern reads skill and toolset inventory from Runtime. Runtime reads skills from
its stored inventory snapshot and reads toolsets from managed Hermes.

Managed Runtime config sets `skills.allowBundled` to a Tavern sentinel allowlist
with no real bundled skill ids. That keeps Hermes's bundled skill catalog out of
`<available_skills>` while preserving user, workspace, managed, extra directory,
and plugin-owned skills. The catalog hides skills Hermes reports as blocked by
runtime allowlist policy.

Toolsets stay owned by Hermes. Tavern does not copy runtime tools or plugin
packages into `~/.tavern/skills`, and it does not describe toolsets to the model
as Tavern skills.

Runtime-owned workflow packages can still be prepared as managed skills when
they are part of Tavern's product contract. Memory is the current example:
Runtime bundles the `memory` managed skill so agents know where durable
knowledge belongs.
Runtime also bundles first-party product skills such as `tavern` and Plugin
starter skills such as `merchbase`. Plugin starter skills teach the agent when
to use Plugin-owned toolsets; executable Plugin capability lives in Hermes
toolsets, not in the skill body.
Plugin-owned skill and toolset rows are segregated into Plugins tabs and their
toggles are locked because the Plugin record owns enablement. If a Plugin
reserves a flat skill name already used by a user-owned skill, the user resolves
that conflict from Settings -> Plugins. Confirming enablement replaces the
existing skill with the Runtime-owned Plugin starter guide.
The Runtime-owned `memory`, `tavern`, and Plugin starter skill copies are
read-only and refreshed from Tavern assets on startup. Agent-created,
hub-installed, workspace, personal, extra-directory, and plugin-owned skills
remain owned by their source location and keep their normal Hermes editability.
Tavern refreshes inventory after Hermes reports skill-related writes; it does
not become the editor or merge owner for those files.

Memory is a Tavern-managed skill and Markdown root. Runtime installs the
read-only `memory` skill so agents know when to use direct Memory edits and
where durable context belongs.

Plugins stay owned by the runtime that exposes them. Hermes plugins may add
skills, workflows, tools, channels, or runtime behavior. Codex native plugins
remain Codex app-server capabilities surfaced through Hermes when its Codex
app-server runtime is enabled. Codex-only catalog rows must be labeled as
Codex-only rather than presented as Hermes skills. Tavern does not copy runtime
skills or plugins into `~/.tavern/skills` or describe plugins to the model as
Tavern skills.

## Trust and safety

Hub skills carry an engine trust tier (built-in, trusted, community) shown as a
badge. The preview shows the SKILL.md and the exact files an install would
write. The engine's install-time security scan runs before install; a blocked
verdict disables the install action, and findings are listed in the preview.
Tavern surfaces these signals but does not re-implement scanning or policy —
the engine owns quarantine, scan, and install policy.

## What is intentionally missing

* A skill marketplace or cross-registry search. The engine's hub search
  (ClawHub, skills.sh, LobeHub, the centralized index) is not a Tavern product
  surface; users bring repos they trust as taps.
* A Tavern-owned registry, version pinning UI, update scheduler, or
  merge-conflict manager. The settings surface may start an agent task to
  update a skill, but the update itself remains Hermes agent-managed skill
  editing.
* Converting runtime plugins or toolsets into Tavern skills.
* Expanded troubleshooting flows for unusable toolsets.
