# Permissions

Permissions are Tavern's product surface for what the agent may do without
asking.

## Product Expectations

- A person can set the approval mode for risky agent actions: ask first,
  always allow, or always deny.
- Automations have their own approval mode, since scheduled work cannot wait
  on a prompt.
- A person can maintain an allowlist of pre-approved commands. The allowlist
  is visible and editable in Settings.
- Live approval prompts in chat and the Settings policy are one surface:
  answering a prompt with "always" persists a visible allowlist rule, and
  removing the rule restores prompting.
- Defaults are safe: risky actions prompt, automations do not silently gain
  broader permissions than interactive chat.

## Ownership

- Tavern Runtime is canonical for the permission policy. Generated managed
  runtime config materializes it; Hermes enforces it at execution time.
- Live approval prompts remain runtime activity delivered through the normal
  chat activity surface ([activity-log.md](activity-log.md)); Permissions only
  governs policy and persistence.
- The agent cannot change its own permission policy.

## UI

- A Permissions section in agent settings: approval mode, automation approval
  mode, and the command allowlist as unified card rows with add/remove.
