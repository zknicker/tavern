---
summary: Tavern frontend channel contract for routing chat messages to Tavern Agent seats.
read_when:
  - changing Tavern App chat send behavior
  - changing Agent seats, Agent sessions, or agent-channel dispatch
  - changing how Runtime maps agent execution into durable Tavern chat records
---

# Tavern Agent Channel

Tavern App is one first-party chat frontend for Tavern agents and humans. It
does not share transcript state with Discord, Telegram, CLI, or SDK frontends.
Each frontend can talk to the same Tavern agents through its own channel and its
own conversation history.

## Position

```text
Tavern App
  -> Tavern Server
  -> Tavern Runtime Chat API
  -> Tavern agent channel
  -> agent engine session
```

Tavern Runtime owns canonical chats, participants, messages, events, responses,
activity, reads, Agent seats, Agent sessions, and Agent turns. Tavern App and Tavern
Server proxy and present Runtime state; they do not own executable agent state.

## Agent Seats And Sessions

An agent participant in a Chat is the Agent seat:

```text
ChatParticipant
  chatId
  id
  kind: agent
  currentAgentSessionId
```

An `AgentSession` is the current execution context for that Agent seat:

```text
AgentSession
  chatId
  agentParticipantId
  agentId
  generation
  effectiveModel
  runtimeSessionId
  resumeState
  status: active | archived | stopped
```

The Agent seat is stable product state. The Agent session can rotate when the
user starts fresh context for the same Agent seat or when Runtime must cross an
incompatible execution boundary. Rotating the session archives older active
sessions and updates the seat's `currentAgentSessionId`; it does not remove the
agent from the chat.

## Send Flow

1. Tavern App creates a client message id and renders an app-local optimistic
   user row.
2. Tavern Server calls Runtime `POST /api/chats/{chatId}/messages` through the
   Runtime client. The target identifies the Tavern chat and selected agent; it
   does not include caller-provided engine routing ids.
3. Runtime validates the chat and agent, resolves the Agent seat, ensures the
   current Agent session, writes the durable user message, and creates a
   running response.
4. Runtime dispatches the message to the generated Tavern agent channel with
   the current Agent session and Tavern message context.
5. Runtime returns an accepted receipt with `runId`.
6. The channel streams engine events back to Runtime. Runtime maps assistant
   output into durable response, activity, and assistant message records.
7. Tavern App reconciles optimistic rows from durable chat reads and realtime
   events. Missed websocket notifications are recovered by refetching Runtime
   chat history and events.

There is no private Tavern outbox table and no Tavern chat session key. The
Agent session id is the durable execution context for a Tavern Agent seat, and
the Agent turn id identifies one execution attempt.

## Metadata

Runtime stores agent execution facts under `metadata.runtime`:

```json
{
  "runtime": {
    "source": "agent-engine",
    "agentId": "agt_primary",
    "agentSessionId": "ags_cht_general_agt_primary_1",
    "runId": "run_msg_123",
    "engineSessionId": "ses_..."
  }
}
```

`agentSessionId` is Tavern Runtime execution state for the Agent seat. Engine
session ids and resume state are execution evidence, not product routing
identity.

## Frontend Boundaries

* Tavern App chat messages appear in Tavern App.
* Discord messages appear in Discord.
* A future Telegram or SDK channel owns its own conversation ids and delivery.
* Shared agents, model configuration, skills, Memory reads, and tool policy live
  in Tavern Runtime, not in individual frontend clients.

Human-only chat messages are valid Tavern messages. They invoke an agent only
when Runtime routes them to an Agent seat, such as through selected-agent send,
mention routing, command routing, or automation.

## Commands

`/new` and `/clear` rotate the current Agent session for the selected Agent
seat. `/clear` also clears the Tavern chat timeline. Both commands operate
through Runtime, not through app-local state.

Stop and steering controls target the active Runtime turn. Runtime maps those
controls to engine APIs when available and reports unsupported controls as
normal failed or declined Runtime operations.
