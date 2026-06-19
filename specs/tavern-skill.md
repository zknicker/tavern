# Tavern Skill

The `tavern` skill is the agent's interface to Tavern itself: product
knowledge for advising the user, and operational access for acting on Tavern
state.

## Product Expectations

- The agent can answer questions about Tavern accurately: what Tavern is,
  where settings live, how chats, sessions, automations, skills, and memory
  work as products.
- The agent can operate Tavern on the user's behalf within explicit bounds:
  find and read chats, send messages, and manage automations with Tavern
  delivery semantics.
- The skill speaks product language. It does not name Hermes or describe
  engine plumbing.
- The skill degrades gracefully: when Runtime is unreachable or a capability
  is down, the agent reports the limitation instead of inventing state.

## Ownership

- Tavern Runtime owns the skill content and installs it into the managed
  skills surface, the same lifecycle pattern as the `vault` skill. Users do not
  hand-install or edit it; Runtime refreshes it on sync.
- The skill authenticates to Tavern Runtime with the runtime URL and token
  already provisioned to the managed engine environment.
- Tavern Runtime owns the API surface the skill calls. Skill recipes are thin
  documented calls; product behavior lives in Runtime.

## Capabilities

The skill documents and exposes:

- **Chats.** List and search the agent's Tavern chats; read chat history.
- **Messages.** Send a message to a Tavern chat, attributed to the agent.
- **Automations.** Create, inspect, update, and delete automations using
  Tavern nouns and the Tavern delivery contract ([cron.md](cron.md)).
- **Skills.** List the agent's enabled skills and toolsets.
- **Self-configuration (read-only).** Read the agent's own model, effort, and
  enabled capabilities so it can describe its configuration to the user.
- **Settings map.** Where the user changes each setting in the app, so the
  agent can direct rather than guess.

## Boundaries

- No raw engine config mutation. Configuration changes route the user to the
  appropriate settings surface.
- No app-local state: cache, presentation, or app settings.
- No secret reads or writes.
- Message sends and automation writes are attributed to the agent and visible
  in normal chat and automation history; the skill adds no hidden side
  channels.
