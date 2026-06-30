# Chat-Native Multi-Agent Runtime

Implement [ADR 0007](../docs/adr/0007-chat-participants-own-agent-sessions.md):
Tavern is a Discord-style chat app where channels, DMs, chat participants,
Agent seats, Agent sessions, and Agent turns are first-class.

## Goal

Build a fresh-schema Tavern Runtime that owns chat-native multi-agent state and
executes agents through AI SDK HarnessAgent or AI SDK LanguageModel routes.

## Non-Goals

- No migration from old local data.
- No compatibility layer for retired runtime shapes.
- No interactive tool approval prompts.
- No default-listener agents in channels.
- No Docker or Podman sandbox implementation yet.
- No Discord or Telegram frontend implementation yet.

## Slice 1: Clean Architecture Boundary

- Keep Tavern Runtime as the authority for chats, participants, Agent sessions,
  Agent turns, models, tools, and execution.
- Keep Tavern App and Tavern Server as UI/API clients.
- Keep AI SDK as the execution dependency.
- Define core Runtime contracts: `Chat`, `ChatParticipant`, `AgentSession`,
  `AgentTurn`, `ModelRecord`, `AgentRuntimeProfile`, `SandboxMode`.

Acceptance:

- Product/runtime docs and API contracts describe Tavern Chat, Agent seats,
  Agent sessions, AI SDK executors, static tool grants, and local sandbox mode.

## Slice 2: Fresh Runtime Data Model

- Update Runtime DB bootstrap for fresh schema only.
- Add channel and one-to-one DM chat types.
- Add chat participants.
- Treat an agent participant as the Agent seat.
- Add the current Agent session pointer on the Agent seat.
- Add Agent sessions and Agent turns.
- Seed `#general`, the local human participant, the bootstrapped Tavern Agent
  participant, and an optional one-to-one Tavern Agent DM.

Acceptance:

- Runtime can create and read a channel with humans and agents.
- Runtime can create and read a one-to-one DM.
- One Agent seat has exactly one current Agent session pointer.

## Slice 3: Agent Execution

- Implement `AgentExecutor` as the Runtime execution boundary.
- Execute Claude Code and Codex model records through AI SDK HarnessAgent.
- Execute OpenAI, OpenAI-compatible, and deterministic e2e records through AI
  SDK LanguageModel routes.
- Implement `sandbox.kind: 'none'` using
  `.tavern/agents/<agent-id>/workspace`.
- Auto-approve enabled tools.

Acceptance:

- Claude Code HarnessAgent model can complete a Tavern Agent turn.
- Codex HarnessAgent model can complete a Tavern Agent turn.
- OpenAI/API-key model can complete a Tavern Agent turn.
- All executors write Tavern-native messages/activity.

## Slice 4: Model Catalog And Session Model

- Store concrete runnable model routes in the Runtime model catalog.
- Include execution kind on each Model record: `language-model` or `harness`.
- Store the default model on the Agent runtime profile.
- Store the effective model on the Agent session.
- Make settings model changes update the Agent runtime profile default.
- Make chat-scoped model commands update the current Agent session.
- Keep curated Claude Code and Codex rows visible even when provider setup is
  missing; mark those rows unavailable and surface provider warnings.

Acceptance:

- Changing the model in Settings changes that Agent definition's default for
  new sessions.
- Changing the model in one Chat affects that Agent seat's current session, not
  every Chat using the same Agent definition.
- Cross-execution-kind model switches rotate to a new Agent session.

## Slice 5: Chat API And Addressing

- Message send writes a durable human Chat message.
- Channel messages invoke agents only by mention.
- One-to-one Agent DMs invoke the Agent implicitly.
- One Agent seat serializes its own turns.
- Different Agent seats in one channel may run concurrently.
- Active turn streams are transient and separate from durable Chat history.

Acceptance:

- API clients can send human-only channel messages.
- API clients can mention one or more agents in a channel.
- API clients can DM an agent.
- Stopping a turn is a Runtime command, not a browser stream disconnect.

## Slice 6: Tavern App UI Rework

- Replace single-agent chat UI with workspace chat UI.
- Sidebar sections: Channels and Direct messages.
- Main route renders a Chat, not an agent session.
- Composer supports `@agent` mentions.
- Agent DM invokes the Agent implicitly.
- Settings exposes Agents as a list/detail surface, even if v1 bootstraps one
  Agent.
- Add "New session" on an Agent seat in a Chat.
- Remove stale single-agent settings.

Acceptance:

- App opens to `#general`.
- User can send a human-only message.
- User can mention the Tavern Agent in `#general`.
- User can DM the Tavern Agent.
- User can start a new session for the Agent in the current Chat.

## Slice 7: Verification

Run the smallest relevant lane after each slice, then full verification before
shipping:

- Runtime store/contract tests.
- Server API tests.
- Model catalog tests.
- Agent executor tests with fake models.
- Harness smoke tests for Claude Code and Codex.
- Website component tests for sidebar, composer, mentions, and timeline.
- Playwright e2e.
- Manual in-app-browser smoke:
  - open app
  - send human-only channel message
  - mention Agent in `#general`
  - DM Agent
  - switch default model in Settings
  - start new session
  - verify OpenAI, Claude Code, and Codex turns

## Stop Conditions

- Runtime contract ambiguity that would change DB shape.
- HarnessAgent API behavior that prevents local-first execution.
- A failed verification lane whose failure is not clearly unrelated.
