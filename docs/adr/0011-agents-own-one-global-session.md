---
summary: Decision to give every agent one persistent global harness session spanning all its chats, superseding per-seat session ownership.
read_when:
  - changing agent session ownership, rotation, reset, or model switching
  - changing how agent turns are scheduled across chats
  - changing the seen-ledger, catch-up, or action-gating contracts
  - reading the history behind ADR 0007
---

# ADR 0011: Agents Own One Global Session

## Status

Accepted. Supersedes the session-ownership decision of
[ADR 0007](0007-chat-participants-own-agent-sessions.md); that ADR's
chat/participant/turn-evidence contracts remain in force.

## Context

ADR 0007 made the agent's chat participant row (the Agent seat) the owner of
the current harness session: one agent in three chats had three independent
model contexts, rotated daily. That bought strong chat isolation and per-chat
concurrency, at the cost of the product thesis — an agent that cannot
remember a DM while answering in a channel is a disposable assistant, not a
teammate.

Raft ships the alternative at production quality and we verified its
mechanics against the installed runtime: one persistent harness session per
agent across every channel, DM, thread, and task; a per-target model-seen
ledger between canonical history and model context; no scheduler beyond the
inbox itself; no scheduled rotation; human-only resets. Tavern already
landed the delivery groundwork (busy delivery, freshness gate,
default-evaluate addressing).

Tavern is a single-operator product today with small trusted teams as the
likely multi-human future.

## Decision

**One agent owns one persistent harness session spanning all its chats.**

- The Agent seat remains the durable routing identity for membership,
  addressing, authorship, and evidence. It no longer owns a session.
- **No trust domains.** The agent is an entity: what it learns anywhere is
  its own knowledge, available wherever it speaks. Confidentiality is taught
  discretion (prompt rules, memory notes), not architecture. Hard isolation,
  when genuinely required, is a separate agent — the boundary that already
  isolates everything. Product norm for multi-human spaces: do not tell an
  agent what you would not tell everyone who can talk to it.
- **Full serialization.** One turn at a time per agent, across all chats.
  Mid-turn traffic reaches the live turn through busy delivery; dedicated
  turns queue. Parallelism is achieved with more agents, not forked context.
- **Auto-drain.** A turn ending with pending unseen traffic immediately
  starts the agent's next turn. The inbox is the queue; there is no
  priority scheduler.
- **Seen ledger + action gating.** Runtime keeps a durable per-(session,
  chat) record of what has provably been model-visible. Outbound actions
  against a stale chat are held with the unseen rows embedded
  (specs/steering.md's freshness gate, generalized).
- **No scheduled rotation.** Sessions live until: a manual reset, an agent
  model switch (fresh session on next turn; workspace, memory, and identity
  persist), or a ~7-day fully-idle safety valve. Engine-native compaction
  plus Memory carry long-horizon continuity.
- **Reset is a human-initiated, agent-scoped contract** living in agent
  settings: session reset (fresh context; workspace and memory persist) and
  full reset (context and workspace wiped). Raft's restart level (resume
  as-is) is a no-op here — turns already resume the session from durable
  state — so it has no surface. The chat drawer shows session status
  read-only.
- **Model selection is agent-scoped.** Per-chat model overrides are removed.

## Consequences

- specs/sessions.md is the normative session contract; ADR 0007's session
  shape is historical.
- An agent busy with a long task is genuinely busy everywhere — that is the
  intended presence model, with stop and busy delivery as the interrupts.
- Greenfield cutover: existing per-seat sessions become inert history; every
  agent starts one fresh global session. No migration machinery.
- Chain-guard budgets and turn-outcome semantics move from per-seat to
  per-agent accounting.
- Prompt teaching gains cross-chat awareness and DM-discretion rules; the
  prompt contract suite tracks them.
- The privacy caveat is documented, not engineered: models resist deliberate
  extraction less reliably than humans.
