# Hermes Agents

Hermes agents are durable workers and personalities owned by Hermes.

## Product Expectations

- An Hermes agent has a stable Hermes identity.
- An Hermes agent has a user-facing name.
- An Hermes agent has durable instructions that define how it behaves.
- An Hermes agent may expose editable files. File names and meanings come from Hermes.
- An Hermes agent has durable working context according to Hermes's own model.
- A runtime agent can participate in conversations, scheduled jobs, and delegated work when the
  Hermes supports those capabilities.
- An Hermes agent feels like the same entity wherever Tavern presents it.

## Agent State

- Hermes stores the execution config used by the agent.
- Hermes composes the execution-time prompt from its own prompt, hook, skill, memory,
  identity, project, and live execution layers.
- Tavern may read and update supported agent config through Hermes Gateway.
- Tavern may browse and edit supported agent files through Hermes Gateway.
- Tavern may store presentation overlays for the agent.
- Tavern does not define agent identity from channel identity or chat identity.

## Participation

- An Hermes agent may participate in zero or more chats.
- A chat may include one or more Hermes agents when Hermes supports multi-agent chat
  participation.
- Tavern product flows currently resolve one primary agent, while runtime calls should still target
  an explicit Hermes agent id.

## Delegation

- Hermes agents may delegate work if Hermes supports delegation.
- Delegated work should remain attributable to a real Hermes agent or Hermes session.
- Temporary helper sessions and execution teams are Hermes techniques, not replacements for the
  durable Tavern agent record.

## Constraints

- Agent identity does not come from the channel.
- Agent identity does not come from the chat.
- Project context files such as `AGENTS.md` do not define the runtime agent's stable personality.
- A runtime agent does not require a separate runtime process unless the runtime chooses that model.
