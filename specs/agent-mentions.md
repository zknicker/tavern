---
summary: Agent-authored mentions — agents address other agents in shared chats, with chain limits that prevent runaway loops.
read_when:
  - changing agent-to-agent mention dispatch, chain limits, or handoff behavior
  - changing how assistant replies trigger other agents' turns
  - changing mention parsing for agent-authored messages
---

# Agent-Authored Mentions

Agents in a shared chat can hand work to each other by mentioning another
agent in a reply, exactly the way a human does: a rich reference
`[Name](agent://<agentId>)` in the message content. A mentioned agent gets its
own turn. This spec is normative for dispatch semantics; the reference grammar
lives in [mentions.md](mentions.md).

## What dispatches

- Only messages a completed turn **delivered into a chat** are parsed for
  agent mentions: the final reply in the turn's own chat, and any cross-chat
  posts the turn made via `chat_send`. Preambles, commentary, tool output,
  activity rows, and steering text never dispatch. A `NO_REPLY` turn delivers
  nothing and therefore dispatches nothing — staying silent ends a handoff
  chain.
- A mention dispatches only when the target is an **agent participant of the
  chat the message landed in** — the turn's own chat for the final reply, the
  target chat for a cross-chat post. Mentions of non-participants and unknown
  agents render as text and are ignored. Self-mentions never dispatch, and one
  turn dispatches at most one turn per (chat, agent) seat.
- Cross-chat posts are how an agent consults an agent that is not in the
  current chat. The post itself never starts a turn for its author; dispatch
  happens when the posting turn completes, so a cancelled turn wakes no one.
- Mentions of the human render as chips but do not dispatch anything; there is
  no notification side effect today.
- The dispatched turn's trigger message is the mentioning agent's delivered
  message. The target agent reads it as a normal addressed message through its
  own session, with ambient channel context as usual.

## Chain limits

Every turn carries chain metadata. A turn triggered by a human message,
automation, or dispatch starts a fresh chain (`mentionHops: 0`). A turn
dispatched from an agent mention inherits the chain and increments the hop
count.

Two independent guards bound every chain. Both are chain-scoped, not
chat-scoped: a chain that crosses chats through `chat_send` spends the same
depth and budget as one that stays home.

- **Hop cap.** A mention dispatches only when the mentioning turn's
  `mentionHops` is below `maxMentionHops` (default 4). This bounds chain
  depth: human → A → B → C → D, then stop.
- **Chain budget.** Runtime counts dispatched mention turns per origin
  (the chain's founding trigger message). Once a chain has dispatched
  `mentionChainBudget` turns (default 8), further mentions in that chain are
  suppressed. This bounds fan-out: one reply mentioning several agents
  consumes budget for each dispatched turn. The budget counter is
  Runtime-process state; a restart resets it, and the hop cap remains the
  hard backstop.

When a guard suppresses a dispatch, the mentioning turn's response gets a
visible notice activity ("Mention of <name> was not dispatched: chain limit
reached.") so silence is never mysterious. Suppression is per-mention, not
per-reply.

Existing invariants that also contain chains:

- A seat serializes its own turns; mention turns queue like any other.
- `NO_REPLY` breaks a chain by delivering nothing.
- Turn timeout and per-seat queueing bound concurrent execution.

## Prior art

OpenClaw's first generation had no counters at all: loop safety was
structural. Bot-authored messages were dropped at ingest, agents required a
mention in groups, and echo dedup kept an instance from re-triggering on its
own output — agents simply could not hear each other. Once bot-to-bot became
a feature, OpenClaw added a pair-scoped sliding-window budget with cooldown
and a session ping-pong cap broken by a `REPLY_SKIP` sentinel.

Tavern already has the structural layer: dispatch is explicit and
mention-only, `NO_REPLY` declines, and seats serialize their turns. This spec
adds the counting layer — a depth cap plus a budget scoped to the chain
origin rather than the agent pair, because explicit dispatch makes the origin
the natural unit of spend.

## Addressing

- The system-prompt roster teaches the syntax by example: agent participants
  render as `[Name](agent://<agentId>)` entries with their bios, and channel
  instructions state that mentioning an agent in the final reply gives it a
  turn.
- Instructions tell agents to mention another agent only when they need it to
  act, and that `NO_REPLY` is the way to decline a handoff.

## Rendering

Agent-authored mentions render as mention chips wherever the durable message
renders (the transcript reconstructs chips by parsing content, per
[mentions.md](mentions.md)). The transient streaming reveal may show plain
markdown until the durable message exists.

## Non-goals

- No default-listener behavior: un-mentioned agents still never respond to
  channel messages.
- No pair-scoped rate limiting or cooldowns until real usage shows the chain
  guards are insufficient.
