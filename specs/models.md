# Models

Models are Tavern's product surface for understanding Runtime model configuration.

## Product Expectations

- Tavern should present models in product language rather than as raw provider dumps.
- A person should be able to understand which model a runtime agent uses when the runtime reports
  that information.
- Model identity should stay consistent across settings, agents, sessions, memories, and other
  product surfaces.
- Tavern should not require users to edit runtime config files to inspect or select supported
  model settings.

## Ownership

- Tavern Runtime is canonical for provider credentials, provider availability, the model catalog,
  agent default models, and Agent session effective models.
- Runtime agents have Runtime-owned default model settings for new sessions. Tavern product
  settings edit the agent default model by calling Runtime APIs.
- Tavern App and Tavern Server do not keep a competing model registry, selected-model store, or
  provider-specific execution config.
- Tavern does not have an app-owned global default execution model. Model routing is configured in
  Runtime at the agent profile level for new sessions and at the Agent session level for current
  execution.

## Provider Access

- Codex OAuth uses the local Codex auth file as the credential source.
- Claude Code OAuth uses the local Claude Code auth state as the credential source.
- OpenAI credentials entered through Runtime configuration stay in Runtime-owned configuration when
  OpenAI execution is enabled.
- Runtime is the authoritative model provider configuration surface for agent execution.
- Tavern may display provider availability and discovery status from Runtime.

## Catalog

- Tavern displays Runtime model options as a read-only inventory.
- Runtime model rows are the source of truth.
- Runtime model rows include stable id, provider, concrete route, execution kind, availability,
  source kind, and provider auth/source metadata.
- Runtime normalizes provider-specific catalog sources through one model catalog layer before app,
  server, and settings surfaces consume model rows.
- Curated Runtime catalog rows are authored model inventory, not hidden fallback behavior.
- Live provider model APIs are provider-specific enrichment and availability checks for future
  providers. They should not be treated as a provider-agnostic source of product model truth.
- Claude Code and Codex use curated Runtime catalogs for picker rows. Local OAuth-backed CLI
  providers determine availability for execution.
- OpenAI uses the Pi harness API-key route and can use a curated agent-model catalog when
  API-key execution is enabled.
- A model row's `executionKind` is `harness` for every supported agent model.
- Aggregator providers such as OpenRouter may use live or remote model catalogs with Runtime-owned
  caching because their model inventory changes frequently by design.
- The agent model picker shows Runtime models that are valid for agent execution.
- Missing provider access is visible as a provider warning and zero selectable models.

## UI

- `Settings -> Models` shows provider availability and Runtime model options.
- Agent model edits in settings call Runtime APIs and change the agent default model for new
  sessions. Chat-scoped model commands change the current Agent seat session.
