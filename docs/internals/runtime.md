---
summary: Tavern Runtime internals for chat storage, Agent seats, Agent sessions, AI SDK execution, persistence, ingestion paths, and tool boundaries.
read_when:
  - changing the always-on chat server
  - changing agent execution or Runtime ownership
  - changing ingestion paths, execution evidence, managed workspace instructions, or agent-facing Tavern tools
---

# Runtime

Tavern Runtime is the always-on local service behind Tavern. It owns canonical
Chat records, participants, deliveries, reads, responses, activity, Agent
sessions, Agent turns, Memory reads, tool inventory, model provider setup,
executable model inventory, and agent execution.

Tavern App is one frontend. Discord, Telegram, webhooks, SDK clients, and
future surfaces are also frontends. They all talk to Runtime through Tavern Chat
and Agent-session contracts.

## Ownership

- **Runtime owns Chat state.** Messages, participants, responses, activity,
  artifacts, deliveries, and reads live in Runtime SQLite.
- **Runtime owns Agent routing.** A Chat agent participant is an Agent seat with
  a current Agent session binding.
- **Runtime owns execution.** It resolves the current Agent session, chooses the
  model executor, runs the turn, and writes Tavern-native messages/activity.
- **Runtime owns model selection.** Agent profiles store defaults for new
  sessions; Agent sessions store effective models for that Chat.
- **Runtime owns tools.** Enabled tools are auto-approved and run inside the
  configured sandbox mode.

App and Server may cache and present this state, but they must not invent
session ids, model routes, provider availability, or execution policy.

## Execution

Runtime executes turns through the agent-engine path described in
[Agent Engine Runtime](agent-engine-runtime.md).

- Claude Code and Codex use AI SDK HarnessAgent.
- OpenAI and OpenAI-compatible records use the Pi HarnessAgent adapter.
- Browser e2e uses a deterministic fake executor installed by the e2e runtime
  bootstrap, not a model provider route.
- Sandbox mode `none` uses `.tavern/agents/<agent-id>/workspace` as a trusted
  working directory.
- Tool calls are auto-approved. There is no interactive approval prompt.

## Persistence

Durable Runtime state includes:

- `chats`
- `chat_participants`
- `chat_messages`
- `chat_responses`
- `chat_response_activity`
- `chat_deliveries`
- `agent_sessions`
- `agent_turns`
- `agent_runtime_profiles`
- model provider, access, inventory, and selection tables

Active stream handles, process handles, cancellation controllers, and executor
promises are transient Runtime memory. Reconnect recovery reads durable Chat
state and active turn state rather than trusting the browser stream as history.

Runtime starts the task auto-dispatch interval beside the cron scheduler. The
dispatcher reads Runtime-owned global and per-agent settings, derives liveness
from durable Agent turn state, and stops with the Runtime process.

## Ingestion

All frontends create Tavern Chat messages. Agent execution starts only when
Runtime addressing rules route a message to an Agent seat:

- one-to-one Agent DMs invoke the Agent implicitly
- channel messages invoke Agents by mention
- an Agent's delivered final reply can mention co-resident Agents; each
  mention dispatches a turn on that seat, bounded by chain limits
  ([agent-mentions](../../specs/agent-mentions.md))
- future automations or channel-listener settings may create Agent turns

Runtime writes assistant replies as normal Chat messages authored by the Agent
participant. Tool calls, thinking, rich responses, and command output are
execution evidence stored as response activity. Agents can also post directly
into another chat where they hold a seat via the `chat_send` tool
(`chats_list` enumerates their chats); the post starts no turn for its
author, and its mentions of the target chat's agents dispatch chain-bounded
turns there when the posting turn completes.

## Boundaries

Runtime records source facts and execution evidence. Tavern App owns final UI
presentation. Runtime adapters must not author display-only workspace folders,
fake participants, or provider labels that are not source facts.

If a Runtime record is missing a required stable id, timestamp, actor, schedule,
file content, or model route, fail the mapping or mark the capability degraded.
Do not invent values to keep the UI moving.
