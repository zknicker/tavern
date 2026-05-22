# OpenClaw Security

OpenClaw security defines how Tavern Runtime manages OpenClaw while keeping secrets, execution, and
runtime boundaries explicit.

## Product Expectations

- OpenClaw-native credentials stay in managed OpenClaw's native secret store.
- Tavern-configured provider credentials stay in Tavern Vault.
- Tavern Runtime generates the local OpenClaw Gateway token; the app should not expose it.
- Tavern does not read OpenClaw secrets directly.
- Tavern does not read OpenClaw SQLite databases, config files, identity files, or home directories
  directly.
- Tavern Runtime writes generated managed OpenClaw config. Other OpenClaw management happens
  through supported Gateway APIs and plugins.
- Unsupported OpenClaw capabilities should fail visibly rather than silently escalating access.

## Execution Boundary

- Tavern Runtime must launch managed OpenClaw with macOS Seatbelt guardrails.
- Managed OpenClaw runs as the current user with the normal user environment, including the user's
  `HOME`.
- Seatbelt is not a container boundary. Strong isolation belongs in Docker, a VM, a separate macOS
  user, or a separate machine.
- OpenClaw remains responsible for runtime/tool policy inside the guarded process tree.
- Tavern may display OpenClaw-reported security and permission state, but product enforcement starts
  with the managed Runtime launch policy.

## Secrets

- OpenClaw-native provider credentials stay in managed OpenClaw.
- Provider credentials entered through the Tavern app stay in Tavern Vault and may later be
  transported to OpenClaw.
- Tavern-owned memory secrets stay in Tavern.
- Logs, setup status, model-access status, and app UI must not include raw secret values.

## Permissions

- Broader OpenClaw administration should require a management surface intended for that purpose.
- Agent-facing tools that can update memory or identity should be constrained by OpenClaw's own
  tool and filesystem boundaries.
- Tavern should not use agent IPC or agent prompts as the normal authorization path for operator
  configuration.

## Safety Expectations

- A failed sync should not corrupt runtime config.
- A failed turn should not corrupt unrelated Tavern records.
- Managed OpenClaw failure should be visible and attributable to the failing capability or sync
  path.
- Security boundaries should remain understandable from the Tavern Runtime and managed OpenClaw
  surfaces.
