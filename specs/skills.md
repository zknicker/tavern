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

### Skill hub

New skills install through the engine's skill hub: a multi-source catalog with
search, preview, an install-time security scan, and install/uninstall. The
engine aggregates the sources (official, index, ClawHub, GitHub, skills.sh,
LobeHub, Claude Marketplace, direct URL) and owns trust tiers, quarantine,
scanning, install policy, and the install lockfile. Tavern proxies the hub
through Runtime and presents it on the Browse tab; it does not run its
own registry or marketplace.

Custom GitHub repos ("taps") extend the hub with user-owned skill sources,
including private repos when the engine process can resolve a GitHub token.
Taps live in the engine's `skills/.hub/taps.json`; the engine has no HTTP
surface for them, so Runtime owns that file directly — the same managed-config
pattern as the bundled-skill allowlist. A tapped repo exposes skills as
`skills/<name>/SKILL.md` directories.

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
- Tavern reads runtime toolsets through Runtime's managed Hermes proxy.
- Tavern browses, previews, scans, installs, and uninstalls hub skills through
  Runtime's `/skills/hub/*` routes. Install and uninstall are engine background
  actions; Runtime waits for the action to exit and returns one synchronous
  result, and the server refreshes the skill inventory snapshot and emits the
  skill update event afterward.
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

- The Skills tab contains product-visible runtime skills.
- The Toolsets tab contains Hermes toolsets visible to Tavern.
- Skill provenance is shown from source metadata, such as workspace, project,
  personal, managed/local, plugin-owned, or extra directory.
- Toolsets show enabled state, configured state, description, runtime diagnostic
  text, and tool names when useful.
- Skill and toolset rows are not clickable. The page is a catalog and enablement
  surface, not a detail browser.
- Agent usability lives in the row as enabled, disabled, or not usable. Runtime
  diagnostics can explain not usable, but they are not first-class product
  states.
- Internal ids, source paths, runtime config paths, MCP server names, plugin ids,
  and generated config paths are debug details unless the user opens advanced
  status.
- The Browse tab is the install surface: popular and searched hub skills with
  source and trust badges, a "From your repos" group for tap skills, a preview
  dialog with the SKILL.md, file manifest, and scan verdict, and install/remove
  actions. The Sources panel manages hub taps.
- The Add toolset dialog is the MCP surface: the engine's curated MCP catalog
  with one-click install plus custom HTTP/stdio servers with test, enablement,
  and removal.
- A toolset row that reports `not_usable` exposes a Set up action that opens the
  engine's provider matrix: provider selection, env key entry, and the
  provider's post-setup install action.
- Tavern does not build its own marketplace, registry, version pinning UI, or
  update scheduling; the engine's hub owns those mechanics.

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
