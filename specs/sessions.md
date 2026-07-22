# Sessions

One agent owns one persistent harness session spanning every chat it
participates in. Chats and threads are routing and presentation surfaces —
never session boundaries. Different agents are fully isolated. Normative per
[ADR 0011](../docs/adr/0011-agents-own-one-global-session.md) as amended by
[ADR 0014](../docs/adr/0014-cli-is-the-agents-only-output-channel.md);
delivery, cursors, and notices in [inbox.md](inbox.md).

## Product boundary

- `Chat` is the durable conversation container.
- `Agent seat` is one agent's stable participation in one chat: membership,
  addressing, authorship. Seats do not own sessions.
- `AgentSession` is the agent's current global execution context: one active
  session per agent, backed by opaque engine resume state.
- `AgentTurn` is one execution inside the session, anchored to the session
  itself (floating, I1) — never to a chat. A turn's output is whatever the
  agent sends through the `grotto` CLI; there is no reply delivery.

## Attention

- One turn at a time per agent, across all chats. A seat is busy exactly
  when its agent is busy.
- An idle agent's wake claims one drain turn delivering ALL pending targets
  batched; a busy agent sees only content-free notices. Chain budgets bound
  agent-to-agent drains ([inbox.md](inbox.md)).
- A fresh session's first turn is the bare `Start.` message; after a reset
  the fresh-session line rides it.
- Stop remains the human interrupt and stops the agent's live turn.

## Cursors

The two-cursor ledger (`delivered` + `seen` per (session, target)) is
specified in [inbox.md](inbox.md). `seen` is the sole model-seen authority;
the freshness gate lives on the CLI send path exactly once
([grotto-cli.md](grotto-cli.md) §6).

## Rotation and reset

Sessions never rotate on a schedule. A new session starts only on:

1. **Model switch** — the agent's model is agent-scoped; a change takes
   effect on the next turn with a fresh session. Workspace, memory, and
   identity persist.
2. **Manual reset** — human-initiated, agent-scoped, in the agent profile:
   - *Session reset:* fresh context; workspace and memory persist.
   - *Full reset:* fresh context and wiped workspace.
   A reset rotates the agent token and lands a system receipt in the
   agent's built-in DM.
3. **Idle safety valve** — a session untouched for ~7 days starts fresh on
   its next turn (stale-resume guard), identical to a session reset.

Long-horizon continuity across resets comes from engine-native compaction
and the agent's workspace MEMORY.md ([ADR 0014](../docs/adr/0014-cli-is-the-agents-only-output-channel.md)).

## Knowledge and discretion

The agent's knowledge is its own: anything learned in any chat may inform
any other. There are no trust domains. The prompt teaches discretion — what
was shared in a DM was shared with the agent, not with every room; don't
volunteer private specifics elsewhere. Hard isolation is a separate agent.
Multi-human norm: don't tell an agent what you wouldn't tell everyone who
can talk to it.

## Non-goals

- No per-chat model overrides.
- No context forking for threads; harness subagents remain an engine
  execution detail, not a session contract.
- No migration shims: cutover starts every agent on a fresh global session.
