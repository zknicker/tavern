---
summary: Tavern Runtime's agent-engine contract for chats, Agent sessions, AI SDK HarnessAgent execution, model provider setup, executable model inventory, tools, and deterministic tests.
read_when:
  - changing Tavern Runtime agent execution
  - changing AI SDK HarnessAgent execution
  - changing agent instructions, SOUL, runtime skills, tools, steering, or turn activity
  - changing model provider setup, model defaults, or Agent session model selection
  - changing deterministic e2e executor behavior
---

# Agent Engine Runtime

Tavern Runtime is the agent engine boundary. It owns canonical chats, chat
participants, Agent seats, Agent sessions, Agent turns, model provider setup,
executable model inventory, Runtime profiles, instruction composition, tool
exposure, Memory reads, and turn routing.

Tavern App and Tavern Server are clients. They may proxy Runtime data and shape
it for the UI, but they must not own executable agent state. A direct Runtime
API client should be able to list executable models, update an Agent default
model, send a chat message, inspect activity, start a new Agent session, stop a
turn, and steer a turn without the Tavern App process.

Runtime does not depend on Vercel managed infrastructure for local execution.

See [ADR 0007](../adr/0007-chat-participants-own-agent-sessions.md) for the
chat participant and Agent session decision.

## Agent Seats And Sessions

An Agent's participation in a Chat is an Agent seat: an agent participant row
inside that Chat. Each Agent seat owns exactly one current Agent session.

```text
ChatParticipant
  chatId
  participantId
  agentId
  currentAgentSessionId

AgentSession
  id
  chatId
  agentParticipantId
  effectiveModel
  promptContextSequence
  runtimeSessionId
  resumeState
  generation
  status
```

The Agent seat is stable Tavern product state. The Agent session can rotate
when the user starts fresh context for that Agent in that Chat. Rotating
archives older active sessions and updates only that seat's current session
pointer.

A channel with multiple agents is not one engine session. Each Agent seat gets
its own Agent session. Human-only channel messages are valid chat messages and
do not invoke an agent unless addressing rules route them to an Agent seat.

## Execution

Runtime executes every Agent turn through AI SDK `HarnessAgent`. The catalog
record's `executionKind` is always `harness`; it remains in the API as an
explicit execution fact for headless clients.

| Execution kind | Providers | Implementation |
| --- | --- | --- |
| `harness` | Claude Code, Codex, OpenAI, OpenAI-compatible | AI SDK `HarnessAgent` with local trusted sandbox mode `none`. |

Provider adapters are internal implementation choices:

- `@ai-sdk/harness-claude-code`
- `@ai-sdk/harness-codex`
- `@ai-sdk/harness-pi` for OpenAI and OpenAI-compatible API-key routes

The harness executor creates a session, sends the prompt, and consumes the
turn's part stream while it runs: tool calls persist as `running` activity when
they start and `completed`/`failed` when they resolve, reasoning segments
persist as `reasoning` activity when they end, and assistant text segments
persist as commentary activity as soon as a later part proves they are not the
final answer. The last text segment becomes the assistant reply. After
the turn settles it stores the opaque harness resume state on the Agent session
and stops the session handle. The chat response row must already exist when the
turn starts; mid-turn activity rows reference it.
The prompt contains the current Tavern message plus bounded ambient channel
context since the Agent session's `promptContextSequence`; it does not replay
the prior user-agent transcript because the harness session owns that history.
When Memory is enabled and the recall index is provisioned, the prompt also
carries a recalled-Memory block: the triggering message runs a vector search
over the qmd-backed recall index (`apps/runtime/src/memory/recall/`), and up to
three pages above the relevance floor inject as labeled background context.
qmd loads at runtime via dynamic import — its native modules cannot compile
into the single-file Runtime binary — resolving the workspace package in dev
and the artifact-staged copy under `share/tavern/node_modules` when packaged
(`TAVERN_RUNTIME_QMD_PATH` overrides).
Each turn prompt is time-anchored with the current time, and every included
message carries its created-at timestamp. Static per-session guidance — the
chat id, the staleness policy, and Tavern chat/Memory/automation tool
guidance — lives in the composed agent instructions, not the per-turn prompt,
so long sessions carry one copy instead of one per turn.
After a turn settles, Runtime advances `promptContextSequence` to the
triggering message sequence.
Each turn also records prompt evidence — the composed instructions, the
per-turn prompt, and the Memory recall hits — in `agent_turns` metadata at
turn start, served on demand at `GET /api/turns/{run_id}/prompt`. The app's
turn drawer shows the recall matches; dev mode (desktop Developer menu) adds
the raw prompt blob.

Tool calls are auto-approved. Tavern does not expose an interactive tool
approval prompt. Harness tools come from the selected executor, Plugin tools
come from Plugin grants, and safety is controlled through sandbox mode plus any
Runtime approval policy. The current sandbox mode is `none`: a trusted local workspace rooted at
`.tavern/agents/<agent-id>/workspace`. It scopes working directory and files; it
is not a security sandbox.

Harnesses may need local OAuth credentials to call their native CLIs. Runtime
seeds only the required credential files into the workspace-local process home.
It must not inherit arbitrary host configuration files such as Codex
`config.toml`, because host CLI versions and bundled harness SDK versions can
parse different config vocabularies.

Claude Code harness turns run through the same non-interactive Claude Code path
as `claude -p`. If that local path cannot authenticate with a Claude.ai login,
operators can create a subscription-backed long-lived token with
`claude setup-token` and expose it to Runtime as
`TAVERN_AGENT_CLAUDE_CODE_AUTH_TOKEN`.

Executor failures settle the Agent turn and linked response as failed Tavern
state. They must not crash the Runtime process.
Agent turns also have a Runtime watchdog (`TAVERN_AGENT_TURN_TIMEOUT_MS`,
default 5 minutes) so a hung provider settles as failed instead of keeping the
chat active forever.

## Model Providers And Inventory

Runtime owns model provider setup, executable model inventory, and agent model selection.

`apps/runtime/src/models/catalog-service.ts` is the single Runtime model
inventory entrypoint. Provider registry, access state, model count, warnings,
availability, and sorted executable model rows are assembled there.

Curated model lists live in `apps/runtime/src/models/curated/`. Provider
behavior lives in `apps/runtime/src/models/provider-sources/`.

- Claude Code and Codex use curated HarnessAgent model lists.
- Missing local OAuth CLI setup marks enabled provider access as not ready; it does not make the
  provider disappear from Settings.
- OpenAI uses the Pi harness API-key route. It keeps a curated allowlist and may
  enrich executable rows with cached live discovery from the OpenAI models endpoint.

Model records include Runtime execution facts needed by headless clients:
stable `id`, display `label`, `provider`, `route`, `executionKind`,
`availability`, `sourceKind`, and auth/source metadata. Tavern App may choose
icons, colors, and layout. It must not reconstruct model routes or provider
availability from display strings.

The provider catalog is separate from executable inventory. The provider
catalog lists addable providers; Runtime-enabled providers store the user's
provider choices; executable model inventory contains only model records whose
provider access is ready for Agent turns.

## Model Selection

Agent runtime profiles store the Agent default model for new sessions in
`agent_runtime_profiles.default_model_json`. Agent rows do not own model
choices.

When an Agent has no saved model profile, Runtime sets the Agent default to the
highest-ranked executable model. If no executable model exists, Runtime leaves
the Agent without an executable default and surfaces provider setup instead of
falling back to a non-executable provider.

When a saved default model is invalid or unavailable, Runtime Doctor repairs the
Agent default to the highest-ranked executable model. If no executable model
exists, Runtime leaves the Agent unresolved and surfaces provider setup.

Each Agent session stores its own `effectiveModel`; that is the model actually
used by turns in that Chat.

Changing a model in Settings updates the Agent runtime profile default used for
new sessions. It must not read or mutate a random Chat's current session.

Chat-scoped model commands target the current Agent seat session in that Chat.
Model changes update that session in place. Starting fresh context explicitly
rotates to a new Agent session for that seat.

## Instructions And Tools

Runtime composes the bootstrapped Agent's instructions from Tavern-owned agent
files and settings, including `NOTES.md`, `SOUL.md`, tools, and Memory context.
Skills are assigned execution resources, not instruction text. The workspace
lives under the Runtime data root:

```text
.tavern/agents/<agent-id>/workspace
```

Skills are loaded as Runtime turn context, not as an App-side convention. At
turn startup, Runtime reads the agent's `enabledSkillIds` and resolves those
ids against installed skill packages. Harness execution passes the resolved
bundles through the AI SDK `HarnessAgent` `skills` setting so adapters can
surface them as runtime skills. Runtime does not inline `SKILL.md` content into
`system`.

Linked skill references in a message use `skill://<skill-id>` and only nudge the
current turn. Runtime intersects those references with the addressed Agent's
`enabledSkillIds` and adds a compact activation hint for matches. A linked skill
that is not assigned to that Agent produces no hidden prompt context and does
not grant access.

Harness tools come from the selected executor. Runtime exposes built-ins through
`GET /tools` as enabled, configured, read-only diagnostics, but Tavern does not
surface a user-facing Tools page or per-agent tool grant editor. Agent-specific
access is expressed through skill assignments, Plugin grants, sandbox mode, and
approval policy.

Runtime also exposes read-only Tavern chat tools to harness turns:

- `chat_messages_list` lists current-chat messages by sequence cursor.
- `chat_messages_search` searches current-chat message content.
- `chat_message_get` reads one current-chat message by id.

These tools are same-chat only. They are the escape hatch for older Tavern
history that should not be automatically injected into every prompt.

Runtime writes product facts through Tavern stores:

- `chat_messages`
- `chat_responses`
- `chat_response_activity`
- `chat_deliveries`
- `agent_turns`

Provider-specific traces, model usage, finish reasons, and opaque resume state
remain execution evidence in metadata.

## Testing

Use deterministic fake executors for unit and browser e2e flows. Mock only true
external boundaries: model calls, harness processes, network transport, time,
and randomness.

Harness smoke tests should run against the local Claude Code, Codex, and Pi
provider credentials when validating this worktree manually.
