# Skills

Skills are Tavern-managed instruction packages that OpenClaw loads as ordinary workspace skills.

## Product Expectations

- A skill has a stable Tavern package identity.
- A skill package contains instructions and may include supporting files such as scripts,
  references, or assets.
- Tavern installs packages from ClawHub or GitHub into `~/.tavern/skills`.
- Product-facing skill selection applies to the primary agent.
- Runtime/internal storage may still track selections per agent so future multi-agent support has a
  clear extension point.
- Selecting a skill for the primary agent should affect only that agent's OpenClaw workspace.
- Tavern product APIs expose only Tavern-managed skill packages. OpenClaw bundled/runtime skill
  categories are adapter facts, not product fields.

## Ownership

- Tavern is canonical for installed skill packages and the primary agent's skill selections.
- Tavern stores skill packages under `~/.tavern/skills`.
- Tavern materializes selected packages into `<workspace>/skills`.
- Tavern hard-owns the OpenClaw workspace `skills/` directory for agents it manages. Skills added
  there outside Tavern are not supported.
- OpenClaw remains canonical for runtime eligibility, dependency checks, prompt loading, and
  execution behavior.

## Runtime Behavior

- An OpenClaw session should receive only the skills materialized for the acting agent workspace.
- Tavern does not use `skills.load.extraDirs` for selected skills.
- Tavern copies package directories into workspaces; it does not initially use symlinks.
- Every materialized skill directory contains `.tavern-skill.json`.
- Every Tavern-owned workspace `skills/` directory contains `.tavern-managed.json`.
- After materialization, Tavern verifies the result through `skills.status({ agentId })`.
- Verification requires OpenClaw to report the observed runtime source as `openclaw-workspace` and
  `baseDir` matching the expected workspace skill path.
- OpenClaw reports `requirements`, `missing`, `configChecks`, `eligible`, and `install`; Tavern
  surfaces those dependency states in the Skills UI.
- Tavern Runtime launches managed OpenClaw with Seatbelt guardrails and generates OpenClaw config
  for the managed workspace.
- Tavern does not build or manage per-agent Docker sandbox images.
- Install options execute inside managed OpenClaw's Seatbelt process boundary when OpenClaw runs
  package-manager setup such as npm installs.
- Skill environment values are stored per skill in Tavern Vault and should only be materialized
  into the managed OpenClaw config when Tavern intentionally grants them.

## UI Model

- The Skills list contains Tavern-managed packages from `~/.tavern/skills`.
- Skill provenance is shown from `installSource`: ClawHub slug or GitHub repository/path.
- The detail header should show the skill name and description only.
- Primary-agent readiness lives in the detail sidebar with first-class agent identity, visible-in-chat
  state, callable-directly state, missing requirements, and setup status.
- Dependency setup commands are shown only when structured skill metadata provides an install option
  Tavern knows how to translate. Tavern must not infer package-manager commands from a missing
  binary name.
- Skill secrets are managed on the skill detail page. The UI shows whether each declared
  environment value is configured, but never reads saved secret values back from Tavern Vault.
- Tavern checks installed ClawHub packages for newer published versions at most once per day per
  package. The update check reads only installed ClawHub slugs, runs serially, respects ClawHub
  rate-limit headers, and records the last checked time plus any update error.
- Users can manually check one ClawHub skill from its detail page. The detail sidebar always shows
  when the package version was last checked.
- Internal package ids, content hashes, cache paths, and materialized paths are debug details and
  should not be part of the default hero or list presentation.

## Failure Behavior

- If Tavern Runtime cannot write the managed OpenClaw workspace or an agent workspace, skill
  materialization is degraded and skill writes fail visibly.
- If OpenClaw does not report a materialized skill at the expected workspace path, Tavern records a
  sync error for that agent selection.
- Missing dependencies do not remove the package. Tavern keeps the selection visible and surfaces
  the missing OpenClaw requirements.
