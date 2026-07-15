# Sessions

One agent owns one persistent harness session spanning every chat it
participates in. Chats, threads, and tasks are routing and presentation
surfaces — never session boundaries. Different agents are fully isolated.
Normative per [ADR 0011](../docs/adr/0011-agents-own-one-global-session.md);
delivery mechanics in [steering.md](steering.md), dispatch in
[addressing.md](addressing.md).

## Product boundary

- `Chat` is the durable conversation container.
- `Agent seat` is one agent's stable participation in one chat: membership,
  addressing, authorship, evidence attribution. Seats do not own sessions.
- `AgentSession` is the agent's current global execution context: one active
  session per agent, backed by opaque engine resume state.
- `AgentTurn` is one execution inside the session, anchored to the chat that
  triggered it; its reply delivers there, cross-chat effects go through
  `chat_send`.

## Attention

- One turn at a time per agent, across all chats. A seat is busy exactly
  when its agent is busy.
- While a turn runs, new messages from any chat reach it as busy-delivery
  notices; dedicated handling queues.
- **Auto-drain:** when a turn ends and unseen traffic is pending anywhere,
  the agent's next turn starts immediately on the oldest pending chat. The
  inbox is the queue — no priorities, no preemption. `NO_REPLY` and chain
  budgets govern spend.
- Stop remains the human interrupt and stops the agent's live turn.

## Seen ledger

Runtime keeps a durable per-(session, chat) cursor of what has provably been
model-visible: prompt catch-up, busy deliveries, and hold envelopes advance
it; notices never do. The ledger feeds:

- **Turn intake (push):** a turn's prompt carries the trigger chat's unseen
  rows since the cursor, plus a compact cross-chat pending section (counts +
  latest, with chat tools to read more).
- **Action gating:** any outbound action against a chat with unseen rows —
  final reply delivery, `chat_send`, task actions — is held once with the
  unseen rows embedded; the agent delivers, revises, or declines. This is
  the freshness gate generalized from replies to actions.

## Rotation and reset

Sessions never rotate on a schedule. A new session starts only on:

1. **Model switch** — the agent's model is agent-scoped; a change takes
   effect on the next turn with a fresh session. Workspace, memory, and
   identity persist.
2. **Manual reset** — human-initiated, agent-scoped, in agent settings:
   - *Restart:* resume the existing session as-is.
   - *Session reset:* fresh context; workspace and memory persist.
   - *Full reset:* fresh context and wiped workspace.
3. **Idle safety valve** — a session untouched for ~7 days starts fresh on
   its next turn (stale-resume guard), identical to a session reset.

The chat drawer shows the agent's session status read-only; it exposes no
reset. Long-horizon continuity across resets comes from engine-native
compaction, core Memory, and refetchable chat history.

## Knowledge and discretion

The agent's knowledge is its own: anything learned in any chat may inform
any other. There are no trust domains. The prompt teaches discretion — what
was shared in a DM was shared with the agent, not with every room; don't
volunteer private specifics elsewhere. Hard isolation is a separate agent.
Multi-human norm: don't tell an agent what you wouldn't tell everyone who
can talk to it.

## Non-goals

- No per-chat model overrides.
- No context forking for tasks or threads; harness subagents remain an
  engine execution detail, not a session contract.
- No migration shims: cutover starts every agent on a fresh global session
  and leaves old per-seat sessions as inert history.
