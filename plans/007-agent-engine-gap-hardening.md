# Agent Engine Gap Hardening

This plan closes the broad gaps left after the chat-native multi-agent Runtime
base landed. It is scoped to the decisions in
[ADR 0007](../docs/adr/0007-chat-participants-own-agent-sessions.md) and the
implementation slices in
[plan 006](006-chat-native-multi-agent-runtime.md).

## Goal

Make the current implementation match the clean Tavern-native architecture:
Runtime owns chats, participants, Agent seats, Agent sessions, Agent turns,
model catalog, tool inventory, and agent records. App and Server remain clients.
AI SDK is the execution dependency. No Eve, Hermes, OpenClaw, or compatibility
routing concepts should remain in first-party product contracts.

## Gap 1: Presence And Session Binding Vocabulary

Problem:

The current implementation still uses `AgentPresence`, `AgentSessionBinding`,
`presenceId`, `sessionBindingId`, and session-key vocabulary as active routing
state. ADR 0007 reserves "presence" for future online/idle/offline liveness,
not session routing.

Fix locations:

- `apps/runtime/src/tavern/channel-relay.ts`
- `apps/runtime/src/tavern/agent-turn-runner.ts`
- `apps/runtime/src/tavern/*executor*.ts`
- `apps/runtime/src/agent-engine/command-routes.ts`
- `apps/runtime/src/db/schema.ts`
- `packages/tavern-api/src/runtime/contracts.ts`
- `apps/server/src/chat/*`
- `docs/api/chat.md`
- `specs/agent-runtimes/tavern-messenger.md`

Ideal end state:

- A Chat participant row is the stable Agent seat in that Chat.
- The Agent seat owns `currentAgentSessionId`.
- `AgentSession` is the only durable current execution session pointer.
- Agent turns carry `agentSessionId`, not `presenceId` or `sessionBindingId`.
- Public Runtime/API contracts stop exposing presence or session binding for
  routing.
- Any future liveness surface can reintroduce presence with fresh names and no
  execution routing role.

Verification:

- Compare against ADR 0007 "Consequences" and plan 006 Slice 2 and Slice 5.
- Runtime tests prove one Agent seat has one current Agent session and turns run
  through that session.
- Source search finds no active routing uses of `AgentPresence`,
  `AgentSessionBinding`, `presenceId`, `sessionBindingId`, or session-key
  vocabulary.

## Gap 2: Runtime Tool Inventory

Problem:

Agents can execute tools through harness and LanguageModel routes, but Runtime's
tool inventory surface is not yet the truthful catalog. Settings can show an
empty or partial tool list even when the agent has built-in tools.

Fix locations:

- `apps/runtime/src/tavern/proxy.ts`
- `apps/runtime/src/tavern/language-model-tools.ts`
- `apps/runtime/src/tavern/harness-agent-executor.ts`
- `packages/tavern-api/src/runtime/contracts.ts`
- `apps/server/src/skills/service.ts`
- `apps/website/src/features/skills/tools-list.tsx`
- `docs/api/skills.md`
- `docs/features/skills.md`

Ideal end state:

- Runtime exposes a read-only catalog of built-in agent tools available by
  default.
- Catalog rows are Runtime-native tool records with provider/source, execution
  kind, availability, description, and diagnostics.
- Per-agent tool customization is deferred.
- Settings -> Tools reflects the same inventory the executor can use.

Verification:

- Compare against ADR 0007 tool grants and plan 006 Slice 3.
- Runtime/API tests cover `/tools`.
- App/server tests cover Settings -> Tools showing built-in tools.

## Gap 3: Multi-Agent Product Readiness

Problem:

Runtime data can support more than one agent, but the product surface is still
mostly primary-agent-only.

Fix locations:

- `apps/runtime/src/tavern/agents-store.ts`
- `apps/runtime/src/tavern/proxy.ts`
- `apps/server/src/agent-settings/*`
- `apps/server/src/api/agent/router.ts`
- `apps/website/src/features/settings/agents/page.tsx`
- `apps/website/src/features/mentions/*`
- `docs/api/agents.md`
- `docs/features/agents.md`

Ideal end state:

- Settings -> Agent exposes a basic list/create/edit surface.
- Runtime can create additional agents with name, color, default model, and
  generated workspace defaults.
- Mention picker addresses all chat agent participants by `@agent`.
- The current UI may still bootstrap the primary Tavern Agent, but additional
  agents are real records, not placeholders.

Verification:

- Compare against plan 006 Slice 6 and `docs/api/agents.md`.
- Server/runtime tests cover create/list/update.
- Website tests cover list/create/edit and mention options.

## Gap 4: Model Catalog Scope

Problem:

The catalog direction is correct, but scope should be explicit: Claude Code and
Codex harness models plus OpenAI API-key LanguageModel models remain supported
for now.

Fix locations:

- `apps/runtime/src/models/catalog-service.ts`
- `apps/runtime/src/models/curated/*`
- `apps/runtime/src/models/provider-sources/*`
- `apps/runtime/src/agent-engine/model-config.ts`
- `docs/internals/agent-engine-runtime.md`
- `docs/api/agents.md`
- `docs/features/agents.md`

Ideal end state:

- Runtime owns one curated catalog with execution kind per model record.
- Claude Code and Codex use `harness`.
- OpenAI uses `language-model`.
- Settings model default updates the Agent runtime profile only.
- Chat model changes update only the current Agent session for that Agent seat.

Verification:

- Compare against ADR 0007 model catalog and plan 006 Slice 4.
- Model catalog tests include Claude, Codex, and OpenAI.
- Agent settings model tests prove profile default behavior.

## Gap 5: Verification Coverage

Problem:

The current change has targeted tests and manual smoke evidence, but the final
gate should prove the broad product paths after cleanup.

Fix locations:

- `apps/runtime/src/**/*.test.ts`
- `apps/server/test/**/*.test.ts`
- `apps/website/src/**/*.test.tsx`
- `apps/website/e2e/tests/*.spec.ts`
- `docs/operations/testing.md`

Ideal end state:

- Focused tests cover the cleaned contracts.
- E2E covers `#general`, human-only message, agent mention, DM, Settings model
  update, new session, Settings agents, Settings models, and Settings tools.
- Manual smoke covers Claude Code, Codex, and OpenAI where credentials are
  locally available.

Verification:

- Run the verification lane selected by `docs/operations/testing.md`.
- Record failures with exact scope if any lane is blocked by credentials.

## Gap 6: Stale Docs And Contracts

Problem:

Some docs and generated contracts still describe retired permissions, presence,
session binding, toolsets, or legacy engine details.

Fix locations:

- `docs/api/*.md`
- `docs/features/*.md`
- `docs/internals/*.md`
- `specs/*.md`
- `packages/tavern-api/src/runtime/contracts.ts`
- `packages/tavern-api/openapi.yaml`

Ideal end state:

- Docs use the same product nouns as ADR 0007.
- No product docs describe interactive approvals, toolsets, presence routing,
  session-key routing, Eve, Hermes, or OpenClaw as active implementation.
- Generated API contracts match the Runtime product contracts.

Verification:

- Search for retired nouns and inspect each remaining hit.
- Regenerate contracts if the repo tooling requires it.
- Run docs-adjacent type/API checks after contract edits.
