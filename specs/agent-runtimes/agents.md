# OpenClaw Agents

OpenClaw agents are durable workers and personalities owned by OpenClaw.

## Product Expectations

- An OpenClaw agent has a stable OpenClaw identity.
- An OpenClaw agent has a user-facing name.
- An OpenClaw agent has durable instructions that define how it behaves.
- An OpenClaw agent may expose editable files. File names and meanings are OpenClaw-owned.
- An OpenClaw agent has durable working context according to OpenClaw's own model.
- A runtime agent can participate in conversations, scheduled jobs, and delegated work when the
  OpenClaw supports those capabilities.
- An OpenClaw agent feels like the same entity wherever Tavern presents it.

## Agent State

- OpenClaw stores the execution config used by the agent.
- OpenClaw composes the execution-time prompt from its own prompt, hook, skill, memory,
  identity, project, and live execution layers.
- Tavern may read and update supported agent config through OpenClaw Gateway.
- Tavern may browse and edit supported agent files through OpenClaw Gateway.
- Tavern may store presentation overlays for the projected agent.
- Tavern does not define agent identity from channel identity or chat identity.

## Participation

- An OpenClaw agent may participate in zero or more chats.
- A chat may include one or more OpenClaw agents when OpenClaw supports multi-agent chat
  participation.
- Tavern product flows currently resolve one primary agent, while runtime calls should still target
  an explicit OpenClaw agent id.

## Delegation

- OpenClaw agents may delegate work if OpenClaw supports delegation.
- Delegated work should remain attributable to a real OpenClaw agent or OpenClaw session.
- Temporary helper sessions and execution teams are OpenClaw techniques, not replacements for the
  durable Tavern agent projection.

## Constraints

- Agent identity does not come from the channel.
- Agent identity does not come from the chat.
- Project context files such as `AGENTS.md` do not define the runtime agent's stable personality.
- A runtime agent does not require a separate runtime process unless the runtime chooses that model.
