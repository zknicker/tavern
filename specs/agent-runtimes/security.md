# Hermes Security

Hermes security defines how Tavern Runtime manages Hermes while keeping secrets, execution, and
runtime boundaries explicit.

## Product Expectations

- Hermes-native credentials stay in managed Hermes's native secret store.
- Tavern-configured provider credentials stay in Tavern Vault.
- Tavern Runtime generates the local Hermes Gateway token; the app should not expose it.
- Tavern does not read Hermes secrets directly.
- Tavern does not read Hermes SQLite databases, config files, identity files, or home directories
  directly.
- Tavern Runtime writes generated managed Hermes config. Other Hermes management happens
  through supported Gateway APIs and plugins.
- Unsupported Hermes capabilities should fail visibly rather than silently escalating access.

## Execution Boundary

- Tavern Runtime must launch managed Hermes with macOS Seatbelt guardrails.
- Managed Hermes runs as the current user with the normal user environment, including the user's
  `HOME`.
- Seatbelt is not a container boundary. Strong isolation belongs in Docker, a VM, a separate macOS
  user, or a separate machine.
- Hermes remains responsible for runtime/tool policy inside the guarded process tree.
- Tavern may display Hermes-reported security and permission state, but product enforcement starts
  with the managed Runtime launch policy.

## Secrets

- Hermes-native provider credentials stay in managed Hermes.
- Provider credentials entered through the Tavern app stay in Tavern Vault and may later be
  transported to Hermes.
- Tavern-owned memory secrets stay in Tavern.
- Logs, setup status, model-access status, and app UI must not include raw secret values.

## Permissions

- Broader Hermes administration should require a management surface intended for that purpose.
- Agent-facing tools that can update memory or identity should be constrained by Hermes's own
  tool and filesystem boundaries.
- Tavern should not use agent IPC or agent prompts as the normal authorization path for operator
  configuration.

## Safety Expectations

- A failed sync should not corrupt runtime config.
- A failed turn should not corrupt unrelated Tavern records.
- Managed Hermes failure should be visible and attributable to the failing capability or sync
  path.
- Security boundaries should remain understandable from the Tavern Runtime and managed Hermes
  surfaces.
