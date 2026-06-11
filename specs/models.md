# Models

Models are Tavern's product surface for understanding runtime model configuration and memory model
choices.

## Product Expectations

- Tavern should present models in product language rather than as raw provider dumps.
- A person should be able to understand which model a runtime agent uses when the runtime reports
  that information.
- Model identity should stay consistent across settings, agents, sessions, memories, and other
  product surfaces.
- Tavern should not require users to edit runtime config files to inspect supported model settings.

## Ownership

- Tavern Runtime is canonical for provider credentials, Tavern Vault state, the enabled model
  catalog, and Tavern-owned memory model settings.
- Runtime agents have per-agent execution model settings in Hermes config. Tavern product
  settings expose the primary agent's execution model while preserving per-agent settings
  internally.
- Tavern writes the selected provider/model route through Hermes and leaves OpenAI runtime
  selection at Hermes's default runtime. It does not infer Codex app-server runtime from
  `openai-codex` models.
- Tavern does not have a global default execution model. Model routing should be configured at the
  agent level or by the Tavern-owned surface that uses the model.
- Tavern may transport Tavern Vault credentials or enabled model facts to Hermes later, but
  Tavern Vault remains the source of truth.

## Provider Access

- OpenRouter credentials entered in the Tavern app stay in Tavern Vault.
- Tavern-owned provider credentials stay in Tavern. Hermes receives only the generated managed
  runtime config that Tavern chooses to materialize.
- Codex OAuth uses the local Codex auth file as the credential source. Runtime owns the Tavern
  profile/model record and reads `~/.codex/auth.json` for access state and usage, while Codex and
  Hermes continue to refresh that shared local auth.
- Hermes is the authoritative model provider configuration surface for agent execution.
- Tavern may display transport/sync status showing whether Hermes has the credentials it needs.

## Fallbacks

- The agent's execution model has an ordered fallback chain of provider/model routes used when the
  primary route fails.
- The fallback chain is a Tavern product setting edited beside the agent model picker, drawing from
  the same model catalog.
- Tavern Runtime is canonical for the chain and materializes it through generated managed runtime
  config; Hermes applies it at execution time.

## Catalog

- Tavern displays Hermes model options as a read-only inventory.
- Runtime model rows are not a separate source of truth.
- The agent model route picker should show Hermes models that are valid for agent execution.
- The agent thinking picker exposes Hermes's supported effort values directly instead of deriving
  options from provider or model names.

## UI

- `Settings -> Models` edits Tavern Vault credentials and shows Hermes model options.
- Agent model edits live under Hermes Settings as top-level agent settings entries. They
  participate in the shared Hermes config draft and save/discard flow.
- Memory model settings belong to Tavern Runtime memory, not Hermes.
