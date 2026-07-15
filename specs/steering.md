---
summary: Steering v2 — durable messages plus cursor are the truth; mid-turn delivery is an optimization layered on top, with a freshness gate at reply delivery.
read_when:
  - changing mid-turn steering, busy delivery, or the user steer composer flow
  - changing how a running turn learns about new chat messages
  - changing the freshness gate on final reply delivery
  - changing harness busy-delivery capabilities or the bridge user-message frame
---

# Steering

Steering is how new chat messages reach an agent whose seat is mid-turn.
This spec replaces the injection-era model ("steer text into the live turn")
with a delivery model that fits Tavern's data spine:

> **The durable message and the seat's context cursor are the truth.
> Mid-turn delivery is an optimization, never a correctness mechanism.**

## The three layers

1. **Durable message (truth).** Every steer-shaped input — a user's
   composer send during a live turn, an agent's `chat_send` at a busy peer —
   lands as an ordinary durable chat message. It renders normally in the
   timeline with real authorship. Nothing user- or agent-authored is ever
   notice-only.
2. **Cursor (correctness).** A seat's `promptContextSequence` advances only
   at turn end. Any message a running turn did not see is, by construction,
   in the next prompt's channel catch-up. Mid-turn delivery is therefore
   at-least-once and idempotent by sequence: a delivered-and-lost hint costs
   nothing, a missed hint delays nothing past the next turn.
3. **Busy delivery (optimization).** When the engine supports it, Runtime
   pushes a compact notice into the running turn so the agent can
   incorporate new messages before finishing. When it does not, the message
   simply waits for the cursor.

## Busy delivery

### Capability ladder

Each harness declares a busy-delivery capability, resolved per session:

| Mode | Meaning | Current adapters |
| --- | --- | --- |
| `direct` | Runtime may deliver a notice into the running turn at any time; the engine applies it at its own safe boundary. | claude-code (bridge `user-message` frame feeds the CLI's streaming input, which queues to its next step boundary) |
| `none` | No mid-turn delivery. Messages wait for the cursor. | codex, pi (until their bridges expose an equivalent) |

There is no Tavern-side "gated" mode: engines that need boundary gating
(Claude thinking blocks) gate internally, which is why the frame is safe to
send whenever. If an engine later exposes raw injection without internal
gating, the gate lives in the adapter, not in product code.

Capability detection is per-adapter and explicit. An adapter without the
frame is `none`; nothing probes or retries. Delivery into a `none` session
is not an error — it is the ladder working.

### Payload: an inbox notice, not a text splice

Busy delivery never injects the sender's raw text as if the agent's own
user typed it mid-thought. The payload is a bracketed notice formatted like
prompt catch-up lines:

```
[Tavern: new messages in this chat since your turn started:
[seq:214 Tue 2:41:03 PM] Zach: use the March numbers instead
Incorporate what matters before finishing. Your reply still answers the
original message.]
```

- Seq-tagged lines identical to prompt catch-up, so the model's mental
  model is one format.
- Batched: one notice may carry several messages; notices dedupe against
  what has already been delivered to this turn (by sequence), so a busy
  turn is never spammed twice for the same rows.
- Cross-chat sends produce a notice naming the source chat.

Delivered sequences are tracked per run. Rows delivered mid-turn are still
re-shown by the next prompt's catch-up (the cursor does not advance
mid-turn); the duplication is cheap and keeps the cursor semantics exact.

## Entrances

Both steering entrances write through `turn-steering.ts`; that module is
the single seam between "record what happened" and "attempt busy delivery."

### User composer

The composer's steer-vs-queue distinction collapses to **send now**:

- Sending while a turn is live creates the durable user message
  immediately (normal message path, normal rendering — the fake
  user-styled notice row and the notice-only Runtime steer path are
  removed).
- Runtime then attempts busy delivery to the live run. Whether that
  attempt succeeds changes nothing durable — only whether the agent can
  react within the current turn.
- Queued drafts remain an app-local composer affordance (hold a draft,
  release it later); releasing a draft is just a send.
- With several concurrent live runs there is no ambiguity anymore: the
  message is chat-scoped, every busy seat in the chat gets the notice, and
  addressing (specs/addressing.md) decides who acts.

`chat.steer` and the Runtime steer route are retired. Stop remains a
separate control with unchanged semantics.

### Agent sends (`chat_send`)

`chat_send` loses its `mode` parameter. A cross-chat post is always a
durable message; Runtime attempts busy delivery to every busy agent seat in
the target chat exactly as it does for user sends. Whether the post grants
turns is pure addressing (specs/addressing.md) — the sender chooses
targeting with mentions, not delivery mechanics with a mode flag.

`chat_wait_idle` and turn-outcome notes are unchanged by this spec.

## Freshness gate (reply delivery)

The counterpart to pushing context in is stopping stale replies from going
out. When an agent turn completes with a final reply, Runtime checks the
turn's seen horizon — the highest sequence covered by its prompt plus any
busy-delivered notices — against the chat's current head.

- **Fresh** (no unseen rows): the reply delivers normally.
- **Stale** (unseen rows exist): the reply is **held**, and Runtime runs
  one continuation prompt in the same session:

  ```
  [Tavern: your reply was held — these messages landed while you worked:
  [seq:215 ...] Bob: Markdown yes; raw HTML doubtful.
  Your held reply: "<held text>"
  Deliver it unchanged, revise it, or reply NO_REPLY if it is now
  redundant.]
  ```

- The continuation's reply delivers without a second freshness check
  (**one hold per turn**, so a busy chat cannot livelock a seat), unless it
  is `NO_REPLY` — the sanctioned outcome when a peer already answered.
- Held-then-dropped turns settle as completed silent turns with a
  "held for freshness, chose not to reply" activity row, so silence is
  never mysterious.
- The gate applies to agent seats' channel replies. DM replies skip the
  gate (a 1:1 reply is never made redundant by a peer). Turn-outcome notes
  report the post-gate result.

The gate is what makes default-evaluate addressing viable: when several
agents evaluate the same message concurrently, the first delivered answer
turns the others' drafts stale, and each holds, reads the answer, and
usually declines. With busy delivery working, most seats see the peer
answer mid-turn and the gate rarely fires; the gate is the backstop for
`none` runtimes and last-moment races.

## Evidence

- Busy delivery records a notice activity on the receiving turn's response
  ("Delivered 2 new messages mid-turn"), with the delivered sequences in
  runtime metadata.
- A freshness hold records a notice activity on the held turn's response
  ("Reply held for freshness review"), followed by the normal reply or
  silent-turn evidence.
- The steered message itself needs no special rendering — it is an
  ordinary message row.

## Engine requirements

- `@ai-sdk/harness` must expose the bridge's `user-message` inbound frame
  as a host-side API (`session.sendUserMessage(text)` or equivalent). The
  frame and the claude-code bridge consumer already exist; only the host
  method is missing. Until upstream ships it, this is a bun-patched dep
  keyed to the pinned version.
- The executor exposes `deliverToActiveTurn(runId, text)` backed by its
  active-session map; `turn-steering.ts` is its only caller.
- Failure to deliver (turn ended between check and send, adapter refuses)
  is silent from the sender's perspective and falls through to the cursor.

## Migration

- Remove: notice-only `steerTavernChannelTurn` semantics, `chat.steer`
  API, the app's steered-row projection (`runtime_notice_steered` and
  `runtime_notice_agent_steered` rendering), `chat_send` `mode`.
- Keep: `turn-steering.ts` as the delivery seam, `chat_wait_idle`,
  turn-outcome notes, queue-by-default dispatch semantics (now the only
  dispatch semantics, governed by addressing).

## Prior art

Raft/Slock (inspected from `raft-computer` 1.0.0): durable sequence-
numbered inbox as truth; per-runtime `busyDeliveryMode` of
`direct | gated | none` with stdin inbox notices (never raw text splices),
fingerprint-deduped; tool-boundary gating for Claude with a fallback that
disables mid-turn flushing after thinking-block errors; steers to an idle
seat degrade to launching a turn; a send-side freshness hold (SMR-006)
that holds stale sends until the sender reviews newer context. Tavern
adopts the same shape with two simplifications: the engine gates its own
boundaries (no Tavern-side gated mode), and the freshness gate sits on
reply delivery because Tavern replies are implicit turn output rather than
explicit send actions.
