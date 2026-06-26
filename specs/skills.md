# Skills & Toolsets

Skills are reusable instruction packages that Hermes can expose to the agent.

Toolsets are Hermes-owned groups of executable tools. A toolset is not a Tavern
skill. It controls access to runtime tools such as browser, file, MCP, provider,
or plugin-backed tool groups.

## Product Expectations

- A skill has a stable identity from its source.
- A skill contains instructions and may include supporting files such as scripts,
  references, or assets.
- Tavern shows runtime-visible skills without owning their filesystem lifecycle.
- A toolset has a stable Hermes toolset name.
- Toolsets appear beside skills on the Skills & Toolsets settings page because
  both answer "what can the agent do?" for users.
- Toolset rows must be visibly distinct from skill rows.
- Product-facing skill and toolset selection applies to the agent.
- Selecting a skill should affect only the agent's runtime skill access.
- Enabling a toolset should affect only Hermes toolset enablement.
- Tavern product APIs expose runtime-reported skills with source metadata.
  Managed Hermes bundled skills are blocked from prompt eligibility by Runtime
  config, not by a catalog filter.
- Tavern product APIs expose Hermes toolsets as toolset records with configured
  state, enabled state, tools, usability, and runtime-provided diagnostic text.
- Plugins are source packages. They may provide tools, workflows, providers, or
  skills, but they are not a separate product row unless Hermes exposes a
  concrete skill or toolset for them.
- Platform connections are not toolsets. Messaging accounts and places where an
  agent exists, such as Discord servers or channels, remain platform
  connections. Their route records remain bindings.

## Ownership

- Tavern is canonical for the agent's Tavern-side access choices.
- Hermes remains canonical for runtime eligibility, dependency checks, prompt
  loading, toolset state, and execution behavior.
- Runtime-discovered skills remain owned by their source location. Tavern should
  not copy them into a Tavern skill store or the Hermes workspace as part of this
  surface.
- Tavern-managed skill packages are the exception: Runtime owns the `vault` and
  `tavern` skill copies under managed `HERMES_HOME/skills`, refreshes them from
  Tavern assets on startup, and writes them read-only. The agent should create
  or update a separate skill for durable self-edits.
- Agent-managed skill updates are Hermes procedural memory. For writable,
  non-managed skill sources, the agent updates the skill in place, including
  fetching source material and merging targeted changes when the user asks for
  an update.
- Runtime toolsets remain owned by Hermes. Tavern owns only the user's
  Tavern-side enablement request and the Runtime route that sends it to Hermes.
- Hermes plugins may provide skills, workflows, tools, channels, runtime
  behavior, or provider capabilities. Tavern presents only the agent-facing
  skills and toolsets on the Skills & Toolsets settings page.
- Native Codex plugins remain Codex app-server capabilities. Tavern does not
  copy them into a Tavern skill store or the Hermes workspace.

## Source Model

Tavern should preserve source identity instead of flattening everything into one
package type.

### Skill sources

Hermes loads skills from these sources, with later entries taking precedence over
earlier entries when names conflict:

1. `skills.load.extraDirs`
2. bundled Hermes skills
3. `~/.hermes/skills`
4. `~/.agents/skills`
5. `<workspace>/.agents/skills`
6. `<workspace>/skills`

Tavern should show the skill inventory Hermes reports. Tavern should not inject
managed Hermes bundled skills into agent prompt context; Runtime owns the
managed Hermes install and keeps bundled skills available to Hermes itself.

Hermes plugin skills are a hybrid source. A plugin may list skill directories in
`hermes.plugin.json`; those skill directories load only when the plugin is
enabled. Tavern should show the owning plugin when Hermes includes that source
metadata.

### Installable sources

Tavern has no skill marketplace. New skills install from sources the user
chose, listed on the Sources tab:

1. **Taps** — user-added GitHub repos with a `skills/<name>/SKILL.md` layout,
   including private repos when Runtime resolves a GitHub token. Taps live in
   the engine's `skills/.hub/taps.json`; the engine has no HTTP surface for
   them, so Runtime owns that file directly — the same managed-config pattern
   as the bundled-skill allowlist. Runtime lists tap repos itself through the
   GitHub contents API.
2. **Built-in library** — the engine's vendored `optional-skills/` directory:
   official, vendor-maintained skills that are not activated by default.
   Runtime lists this directory from the resolved engine install.

Install state comes from the engine's hub lockfile
(`skills/.hub/lock.json`), which Runtime reads directly. Installs still run
through the engine's hub installer, which owns quarantine, the install-time
security scan, install policy, and the lockfile. Removing a source never
uninstalls skills that were installed from it.

The engine's multi-source hub search (ClawHub, skills.sh, LobeHub, the
centralized index, and similar registries) is intentionally not a Tavern
product surface. Users find skills by browsing the internet and bring the repo
here as a tap.

### Toolset sources

Hermes reports toolsets from its runtime tool registry. Toolsets can come from
Hermes native tools, MCP servers, providers, bridges, or plugins. Tavern should
read the Hermes `/api/tools/toolsets` view through Runtime and should toggle a
toolset through Hermes's toolset enablement route.

Hermes recognizes native plugins and compatible plugin bundles. Plugins can
register tools, providers, channels, hooks, commands, routes, services, skills,
and other runtime surfaces. Tavern should preserve relevant diagnostics without
turning every loader reason into a separate product state.

Codex native plugins are a Codex app-server runtime source. When Hermes exposes
Codex-backed tools through toolsets or skills, Tavern presents those concrete
surfaces. Tavern does not merge Codex app-server skills into the Hermes skill
catalog.

## Runtime Behavior

- Tavern reads runtime-visible skills through the runtime's skill inventory
  surface.
- Tavern reads one installed skill's source-backed detail through
  `/skills/{id}` when the user previews `SKILL.md`.
- Tavern reads runtime toolsets through Runtime's managed Hermes proxy.
- Tavern reads available skills (built-in library, tap listings, and the
  installed lockfile map) through Runtime's `/skills/hub/available` route —
  local reads with no engine HTTP and no centralized index. Preview, scan,
  install, and uninstall flow through the other `/skills/hub/*` routes; install
  and uninstall are engine background actions that Runtime waits on, and the
  server refreshes the skill inventory snapshot and emits the skill update
  event afterward.
- A request to update skill content is an agent task, not a Tavern settings
  mutation. Tavern may start the work from chat or a skill row; Hermes skill
  tooling performs the read/merge/write, and Runtime refreshes the inventory
  after the write.
- Toolset setup flows through Runtime's `/toolsets/{id}/config|provider|env|post-setup`
  routes; env values are written to the engine's env store and never echoed back.
- MCP servers and the MCP catalog flow through Runtime's `/mcp/*` routes; env
  values in server summaries stay redacted by the engine.
- Tavern should not require file materialization to show a skill or toolset in
  this surface.
- When Tavern changes skill or toolset access, it should use supported runtime
  routes instead of writing directly into discovered source directories.
- Hermes reports `requirements`, `missing`, `configChecks`, `eligible`, and
  `install` for skills; Tavern can show those as diagnostic details, but they
  are not separate product states.
- Hermes reports `enabled`, `configured`, `description`, and `tools` for
  toolsets; Tavern can show those as diagnostic details, but they are not copied
  into skill instructions.
- Tavern Runtime launches managed Hermes with Seatbelt guardrails and generates
  Hermes config for the managed workspace.
- Managed Hermes config sets `skills.allowBundled` to a Tavern sentinel allowlist
  with no real bundled skill ids so bundled skills do not appear in
  `<available_skills>`.
- Tavern does not build or manage Docker sandbox images for individual agents.
- Local Codex config files are hints, not the final toolset usability authority.
- Existing Codex app-server threads keep their runtime binding. After changing
  Codex app-server tool access, the user should start a fresh chat/session
  before expecting new tool state.

## UI Model

- Skills and Toolsets are separate settings pages.
- The Skills page is a full-height file-tree browser. Installed skills, Plugin
  skills, tap skills, and the built-in library are grouped as folders in the
  settings sidebar, and each skill exposes a `SKILL.md` file row.
- Selecting `SKILL.md` opens the detail preview beside the tree: rendered
  Markdown, the enable toggle for installed skills, an Uninstall action for
  hub-installed skills, and an Install action (gated by the scan verdict) for
  available skills. Skills the hub lockfile does not know (workspace or managed
  skills) are not uninstallable.
- A sources dialog on the Skills page adds and removes tap repos.
- The Toolsets page contains Hermes toolsets visible to Tavern, the Add
  toolset dialog, and the toolset setup dialog.
- Skill provenance is shown from source metadata, such as workspace, project,
  personal, managed/local, plugin-owned, or extra directory.
- Toolsets show enabled state, configured state, description, runtime diagnostic
  text, and tool names when useful.
- Skill rows open the skill dialog. Toolset rows are not clickable.
- Agent usability lives in the row as enabled, disabled, or not usable. Runtime
  diagnostics can explain not usable, but they are not first-class product
  states.
- Internal ids, source paths, runtime config paths, MCP server names, plugin ids,
  and generated config paths are debug details unless the user opens advanced
  status.
- There is no marketplace search.
- A skill row may offer "ask the agent to update" for convenience. That starts
  normal agent work; it is not a version manager, conflict editor, or background
  update scheduler.
- The Add toolset dialog is the MCP surface: the engine's curated MCP catalog
  with one-click install plus custom HTTP/stdio servers with test, enablement,
  and removal.
- A toolset row that reports `not_usable` exposes a Set up action that opens the
  engine's provider matrix: provider selection, env key entry, and the
  provider's post-setup install action.
- Tavern does not build its own marketplace, registry, version pinning UI,
  merge-conflict UI, or update scheduling. Hermes and the agent own skill
  update mechanics.

## Usability State

Tavern should keep the product state small:

| State | Meaning |
| --- | --- |
| `enabled` | The user wants the agent to use the skill or toolset. |
| `disabled` | The user does not want the agent to use the skill or toolset. |
| `not_usable` | The item is enabled, but the runtime reports that the agent cannot currently use it. |

`not_usable` may include a runtime diagnostic code and message. Tavern should
display useful text when available, but it should not own a normalized taxonomy
for setup, auth, dependency, restart, policy, stale inventory, or marketplace
failures.

## Failure Behavior

- If Tavern cannot read runtime inventory, the page keeps the last observed
  records visible when available and marks current usability as unknown through
  runtime diagnostic text.
- Missing dependencies do not remove the item. Tavern keeps the selection
  visible and can show the runtime's diagnostic text.
- If a toolset is visible but unsupported by the current runtime bridge, Tavern
  keeps it visible with runtime diagnostic text and does not present it as usable
  by the agent.
- If a toolset requires app authentication, Tavern keeps the enablement visible
  and shows runtime diagnostic text explaining why use is blocked.
- If runtime inventory fails, Tavern surfaces the last observed toolset state
  with a stale or unavailable diagnostic instead of inventing a product state.
