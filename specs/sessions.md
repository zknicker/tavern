# Sessions

Sessions are concrete execution records for an Agent seat. They are backed by
Tavern Runtime state plus opaque executor resume data.

## Product Boundary

- `Chat` is the durable conversation container.
- `Agent seat` is one Agent's stable participation in one Chat.
- `AgentSession` is the current rotatable execution context for that seat.
- `AgentTurn` is one execution attempt inside a session.

The Agent seat is the durable routing identity: `(chat, agent participant)`.
The executor's concrete session id is execution evidence. It is not product
routing identity.

## Rotation

`/new`, explicit reset, idle reset, or incompatible model/executor changes
rotate the Agent session for the same Agent seat.

Rotation:

1. archives the previous active session for that seat
2. creates a new active Agent session
3. updates the seat's `currentAgentSessionId`
4. leaves the Chat participant and Chat history intact

## Model State

Agent runtime profiles store default models for new sessions. Agent sessions
store `effectiveModel`, the model actually used for turns in that Chat.

Changing Settings updates the profile default. Chat-scoped model switches update
or rotate the current session for one Agent seat.
