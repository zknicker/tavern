# Skills & Plugins

Skills are reusable instruction packages that the runtime can expose to the agent.

The Skills & Plugins product surface also shows runtime plugins. A plugin is not necessarily a
Tavern skill. It is a runtime-owned package or capability that can add workflows, skills, tools,
app access, channel behavior, or local capabilities when Tavern can verify and enable it.

## Product Expectations

- A skill has a stable identity from its source.
- A skill contains instructions and may include supporting files such as scripts, references, or
  assets.
- Tavern shows skills from runtime-visible sources without owning their filesystem lifecycle.
- A plugin has a stable product identity scoped by its runtime source.
- Plugins appear beside skills on the Skills & Plugins page because both answer "what can the agent
  do?" for users.
- Plugin rows must be visibly distinct from skill rows. A runtime plugin, MCP server, or Codex app
  is never labeled as a Tavern skill.
- Product-facing skill and plugin selection applies to the agent.
- Selecting a skill should affect only the agent's runtime access.
- Enabling a plugin should affect only the agent's runtime config.
- Tavern product APIs expose visible skills with source metadata. OpenClaw bundled/runtime skill
  categories remain source facts, not separate product concepts.
- Tavern product APIs may expose runtime plugins as plugin records with source metadata, usability,
  and runtime-provided diagnostic text.
- Platform connections are not plugins. Messaging accounts and places where an agent exists, such
  as Discord servers or channels, remain platform connections. Their route records remain bindings.

## Ownership

- Tavern is canonical for the agent's Tavern-side access choices and skill secrets.
- OpenClaw remains canonical for runtime eligibility, dependency checks, prompt loading, and
  execution behavior.
- Runtime-discovered skills remain owned by their source location. Tavern should not copy them into
  a Tavern skill store or the OpenClaw workspace as part of this surface.
- Runtime plugins remain owned by their source runtime. Tavern owns only the user's Tavern-side
  enablement choice and the managed config projection needed to grant access.
- OpenClaw plugins may provide skills, workflows, tools, channels, runtime behavior, or provider
  capabilities. Tavern presents only the agent-facing pieces on the Skills & Plugins page.
- Native Codex plugins remain Codex app-server capabilities. Tavern may enable supported plugins
  through OpenClaw Codex harness config, but it does not copy them into a Tavern skill store or the
  OpenClaw workspace.

## Source Model

Tavern should preserve source identity instead of flattening everything into one package type.

### Skill sources

OpenClaw loads skills from these sources, with later entries taking precedence over earlier entries
when names conflict:

1. `skills.load.extraDirs`
2. bundled OpenClaw skills
3. `~/.openclaw/skills`
4. `~/.agents/skills`
5. `<workspace>/.agents/skills`
6. `<workspace>/skills`

Tavern should show OpenClaw-visible skill sources when OpenClaw reports them.

OpenClaw plugin skills are a hybrid source. A plugin may list skill directories in
`openclaw.plugin.json`; those skill directories load only when the plugin is enabled and currently
participate at low precedence. Tavern should show the owning plugin when a skill comes from a
plugin.

### Plugin sources

OpenClaw recognizes native plugins and compatible plugin bundles.

- Native plugins use `openclaw.plugin.json` plus a runtime module and can register tools, providers,
  channels, hooks, commands, routes, services, and other runtime surfaces.
- Bundle plugins use Codex, Claude, or Cursor-compatible plugin layouts such as `.codex-plugin/`,
  `.claude-plugin/`, or `.cursor-plugin/` and are mapped into OpenClaw plugin capabilities.

OpenClaw discovers plugins in this order, with the first matching plugin id winning:

1. `plugins.load.paths`
2. workspace plugins under `<workspace>/.openclaw/<plugin-root>`
3. global plugins under `~/.openclaw/<plugin-root>`
4. bundled plugins shipped with OpenClaw

Plugin enablement is governed by `plugins.enabled`, `plugins.allow`, `plugins.deny`,
`plugins.entries.<id>.enabled`, plugin slots, bundled defaults, and plugin-owned surfaces named by
config. Tavern should preserve relevant diagnostics without turning every loader reason into a
separate product state.

Codex native plugins are a Codex harness source. Tavern should read availability from Codex
app-server inventory when possible and project supported entries into OpenClaw Codex harness config.
Codex native plugins stay Codex-owned and are not represented as Tavern skills.

Codex Computer Use is special. OpenClaw's bundled `codex` plugin does not perform desktop actions
itself. It enables Codex app-server plugin support, finds or asks Codex app-server to install or
re-enable the configured Codex Computer Use plugin when OpenClaw's bridge supports that path,
reloads MCP servers, verifies that the `computer-use` MCP server exposes tools, and then lets Codex
own native MCP tool calls during Codex-mode turns. Tavern's UI should explain this setup path, but
it should not present a general Codex plugin install surface. If Computer Use is required and setup
cannot make the MCP server available, the Codex-mode turn should fail before the thread starts.

## Runtime Behavior

- Tavern reads runtime-visible skills through the runtime's skill inventory surface.
- Tavern should not require file materialization to show a skill or plugin in this surface.
- When Tavern changes skill or plugin access, it should use supported runtime config paths instead
  of writing directly into discovered source directories.
- OpenClaw reports `requirements`, `missing`, `configChecks`, `eligible`, and `install`; Tavern
  can show those as diagnostic details, but they are not separate product states.
- Tavern Runtime launches managed OpenClaw with Seatbelt guardrails and generates OpenClaw config
  for the managed workspace.
- Tavern does not build or manage Docker sandbox images for individual agents.
- Setup actions execute inside managed OpenClaw's Seatbelt process boundary when OpenClaw runs
  package-manager setup.
- Skill environment values are stored per skill in Tavern Vault and should only be projected into
  managed runtime config when Tavern intentionally grants them.
- A Codex harness session should receive only the native Codex plugins enabled for the acting agent
  and supported by the installed OpenClaw Codex bridge.
- Tavern reads Codex plugin availability from Codex app-server inventory when possible. Local Codex
  config files are hints, not the final usability authority.
- Tavern distinguishes native Codex plugin support from special runtime capabilities such as
  Computer Use. Computer Use is configured through its runtime-specific bridge, not as a normal
  `codexPlugins` entry.
- `codexPlugins` entries are limited to plugin marketplaces supported by the installed OpenClaw
  Codex bridge. Unsupported Codex desktop plugins remain visible as unsupported plugins when
  Tavern can observe them.
- Existing Codex app-server threads keep their runtime binding. After changing Codex harness plugin
  config, the user should start a fresh chat/session before expecting new plugin state.

## UI Model

- The Skills list contains runtime-visible skills.
- The Skills & Plugins page contains a Plugins area for runtime-backed capabilities visible to
  Tavern.
- Skill provenance is shown from source metadata, such as workspace, project, personal,
  managed/local, bundled, plugin-owned, or extra directory.
- Plugin provenance is shown from its product source, such as OpenClaw, Codex, or Claude, not from
  raw marketplace paths by default.
- The detail header should show the skill or plugin name and description only.
- Agent usability lives in the detail sidebar as enabled, disabled, or not usable. Runtime
  diagnostics can explain not usable, but they are not first-class product states.
- Plugin detail shows enabled state, source identity, and runtime diagnostic text. It does not show
  copied instructions unless the plugin exposes a concrete skill or workflow package to Tavern.
- Dependency setup commands are shown only when structured skill metadata provides a setup option
  Tavern knows how to translate. Tavern must not infer package-manager commands from a missing
  binary name.
- Skill secrets are managed on the skill detail page. The UI shows whether each declared
  environment value is configured, but never reads saved secret values back from Tavern Vault.
- Internal ids, source paths, and runtime config paths are debug details and should not be part of
  the default hero or list presentation.
- Native runtime details such as plugin ids, MCP server names, Codex marketplace names, and
  generated config paths are debug details unless the user opens advanced status.
- Marketplace, install, uninstall, and update flows are out of scope for the Skills & Plugins
  surface.

## Usability State

Tavern should keep the product state small:

| State | Meaning |
| --- | --- |
| `enabled` | The user wants the agent to use the skill or plugin. |
| `disabled` | The user does not want the agent to use the skill or plugin. |
| `not_usable` | The item is enabled, but the runtime reports that the agent cannot currently use it. |

`not_usable` may include a runtime diagnostic code and message. Tavern should display useful text
when available, but it should not own a normalized taxonomy for setup, auth, dependency, restart,
policy, stale inventory, or marketplace failures.

## Failure Behavior

- If Tavern cannot read runtime inventory, the page keeps the last observed records visible when
  available and marks current usability as unknown through runtime diagnostic text.
- Missing dependencies do not remove the item. Tavern keeps the selection visible and can show the
  runtime's diagnostic text.
- If a plugin is visible but unsupported by the current runtime bridge, Tavern keeps it visible
  with runtime diagnostic text and does not present it as usable by the agent.
- If a plugin requires app authentication, Tavern keeps the enablement visible and shows runtime
  diagnostic text explaining why use is blocked.
- If runtime inventory fails, Tavern surfaces the last observed plugin state with a stale or
  unavailable diagnostic instead of inventing a product state.
