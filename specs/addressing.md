---
summary: Default-evaluate addressing — every agent seat evaluates every chat message; mentions target, silence declines, freshness dedupes. Supersedes agent-mentions.md at implementation.
read_when:
  - changing which agents get turns for a chat message
  - changing mention semantics, evaluation dispatch, or chain limits
  - changing how agents decline, dedupe replies, or hand work to each other
  - changing chat_send dispatch behavior
---

# Addressing

Who gets a turn when a message lands in a chat, and what a mention means.
This spec supersedes the mention-only dispatch model of
[agent-mentions.md](agent-mentions.md) once implemented; chain-guard
machinery carries over adapted.

## Principle

> **Every agent participant evaluates every message delivered into its
> chats. A mention narrows who evaluates; it never widens who can read.
> Silence is a first-class outcome.**

Agents behave like teammates in the room, not like bots waiting for their
name. Whether to speak is the agent's judgment, bounded by chain guards
and deduped by the freshness gate ([steering.md](steering.md)).

## Evaluation dispatch

For every durable message delivered into a chat (human send, agent final
reply, cross-chat `chat_send` post, automation delivery):

- **No agent mentions in the message** → every agent seat in that chat
  except the author gets an evaluation turn.
- **One or more agent participants mentioned** → only the mentioned seats
  get evaluation turns. Unmentioned seats get no turn; the message reaches
  them as ambient catch-up context on their next turn, exactly like any
  message they were present for. Mentioning is targeting, not secrecy.
- **DMs** are unchanged: the one agent seat evaluates every user message.
- Self-mentions and mentions of non-participants dispatch nothing.
  Mentions of humans dispatch nothing.
- A seat serializes its turns; evaluation turns queue like any other. One
  message dispatches at most one turn per seat.

An evaluation turn is an ordinary turn: same prompt shape, same session,
same tools. Its trigger message is the evaluated message. The turn's reply
is optional — `NO_REPLY` completes the turn silently and is the expected
outcome for most evaluations ("this isn't for me", "someone answered",
"nothing to add").

### What a mention means

- **Targeting.** The mentioned agent is expected to act or answer; other
  agents are expected to leave it to them (taught, and reinforced by not
  dispatching their evaluation).
- **Legibility.** Ownership is visible to humans and agents in the
  transcript as a chip.
- Future (not in this spec): attention controls such as per-agent chat
  muting, where mentions pierce the mute. Until muting exists, targeting
  and evaluation-narrowing are the whole contract.

## Chain limits

Default-evaluate multiplies fan-out, so the chain guards generalize from
mention dispatches to **all agent-triggered evaluations**:

- Every turn carries chain metadata. Human messages and automations start
  a fresh chain (`chainHops: 0`). Any evaluation turn triggered by an
  agent-authored message inherits the author's chain and increments hops.
- **Hop cap** (default 4): an agent-authored message dispatches
  evaluations only while its turn's hops are below the cap.
- **Chain budget** (default 8 dispatched turns per chain origin): once
  spent, further evaluations in that chain are suppressed with the
  existing visible suppression notice.
- Budget accounting is per dispatched turn, so an unmentioned agent reply
  into a four-agent channel spends three budget units at once — broad
  chatter exhausts chains fast by design. Mentioned handoffs spend one.
- `NO_REPLY` delivers nothing, so it dispatches nothing: silence still
  ends chains. The freshness gate's held-then-declined outcome is the
  common chain terminator in practice.

Cost note: this model deliberately spends more turns than mention-only
dispatch. The dampers are, in order: prompt-taught etiquette (below),
cheap silent turns (`NO_REPLY` early), the freshness gate, and the chain
guards as the hard bound. If real usage shows waste, add a lightweight
should-respond gate (small-model or heuristic pre-pass) before spending a
full turn — out of scope here.

## Reply dedupe

Concurrent evaluations of the same message will race to answer. Dedupe is
layered, matching what each layer can see:

1. **Etiquette (prompt-taught).** Respect ongoing exchanges — if a human
   is in a back-and-forth with one participant, stay out unless mentioned.
   Only the agent doing a piece of work reports on it. No idle narration;
   no echoing another agent's answer. Prefer `NO_REPLY` when a peer is
   better placed.
2. **Freshness gate (mechanical).** A completed reply is held if unseen
   messages landed during the turn; the agent reads them (usually a peer's
   answer) and delivers, revises, or declines. See
   [steering.md](steering.md).
3. **Task claims (work mutex).** Replying is deduped by the gate; *work*
   is deduped by claiming the tracked task before starting it
   ([tasks.md](tasks.md)). Evaluation turns that would start real work
   claim first; a failed claim means stand down.

## Cross-chat sends

`chat_send` posts a durable message into another chat the sender holds a
seat in. Under default-evaluate its dispatch rule is the same as any
message: mentions target specific seats; no mentions means every agent
seat in the target chat evaluates. The post still never starts a turn for
its author, dispatch still happens when the posting turn completes, and
cross-chat chains spend the same hops and budget as local ones.

The `mode` parameter is removed (see [steering.md](steering.md) — busy
delivery is automatic and dispatch is addressing).

## Prompt teaching

The channel instructions replace "reply only when mentioned" with:

- You see every message in this chat and decide whether to speak.
  `NO_REPLY` is the normal outcome when a message is not for you, when a
  peer is better placed, or when someone already answered.
- A mention of you means you specifically are expected to act or answer.
  Mention another agent only when you need *them* to act; an unmentioned
  message is team-wide.
- Etiquette rules from Reply dedupe §1.

The contract suite gains requirements for each taught behavior in the same
change that lands the prompt text.

## Evidence and UI

- Evaluation turns are ordinary turns: response rows, activity, silent
  completions ("Chose not to reply") all render with existing machinery.
- Suppression notices (chain limits) are unchanged.
- No new UI is required for v1. Mute controls, should-respond gates, and
  per-seat attention settings are future work with their own specs.

## Migration

- Runtime dispatch: replace mention-gated dispatch in
  `agent-mention-dispatch.ts` with evaluation dispatch per the rules
  above; generalize chain metadata (`mentionHops` → `chainHops`,
  origin-scoped budget unchanged in shape).
- Human messages: today only mentioned agents (or the DM agent) get
  turns; under this spec an unmentioned channel message dispatches every
  agent seat. This is the headline behavior change and should ship with
  the freshness gate, not before it.
- `specs/agent-mentions.md` gains a superseded-by pointer when this
  lands; its rendering and reference-grammar sections remain valid (see
  [mentions.md](mentions.md)).

## Prior art

Raft/Slock: agents are pull-based chat clients — ordinary channel
delivery wakes every joined, unmuted member (agents included); sending is
an explicit CLI act so silence is the structural default; @mentions
target, make ownership legible, and pierce mutes, but never restrict
visibility ("channels are the isolation boundary"); duplicate replies are
contained by etiquette prompts, task claims, and send-side freshness
holds (SMR-006). Tavern adapts this to its push-based turn model:
evaluation turns replace wake-and-pull, `NO_REPLY` replaces
don't-send-anything, the freshness gate moves to reply delivery, and
mention-narrowed evaluation stands in for mute-plus-pierce until real
attention controls exist.
