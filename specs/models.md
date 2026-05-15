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
- Runtime agents have per-agent execution model settings in OpenClaw config. Tavern product
  settings expose the primary agent's execution model while preserving projected per-agent settings
  internally.
- OpenClaw execution runtime selection is model-scoped. Tavern writes
  `agents.list[].models["provider/model"].agentRuntime.id` alongside the selected
  `agents.list[].model.primary`; it does not write whole-agent runtime pins.
- Tavern does not have a global default execution model. Model routing should be configured at the
  agent level or by the Tavern-owned surface that uses the model.
- Tavern may transport Tavern Vault credentials or enabled model facts to OpenClaw later, but
  Tavern Vault remains the source of truth.

## Provider Access

- Provider credentials entered in the Tavern app stay in Tavern Vault.
- Tavern-owned provider credentials stay in Tavern. OpenClaw receives only the generated managed
  runtime config that Tavern chooses to materialize.
- OpenClaw should not be treated as the authoritative credential store for Tavern-configured
  model providers.
- Tavern may later display transport/sync status showing whether OpenClaw has received the
  credentials it needs.

## Catalog

- Tavern may maintain a curated local catalog for UI presentation.
- The enabled model catalog is Tavern-owned.
- Catalog records are not proof that OpenClaw has received credential material.
- The agent model route picker should show enabled Tavern models that are valid for agent
  execution.

## UI

- `Settings -> Models` edits Tavern Vault credentials and the Tavern-owned model catalog.
- Agent model edits live under OpenClaw Settings as top-level agent settings entries. They
  participate in the shared OpenClaw config draft and save/discard flow.
- Memory model settings belong to Tavern Runtime memory, not OpenClaw.
