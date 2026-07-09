# Chat Timeline And Turn Evidence

The chat timeline is the conversation. Agent turn evidence is the record of how an agent produced
its contribution. They are separate models with separate contracts, and they never mix in one
projection.

## Product Expectations

- A chat reads like a conversation between participants. Humans and agents contribute messages;
  nothing else appears as a timeline unit.
- An agent's chat message is the output of an agent turn. The turn itself — thinking, narration
  drafts, tool calls, retries — is execution evidence, not conversation.
- While a turn runs, the chat shows that agent's one in-progress contribution evolving in place,
  as if the agent were editing its comment. Narration and streamed text are successive states of
  that single contribution, never additional timeline units.
- When a turn completes, its durable message replaces the in-progress contribution in place. The
  timeline gains exactly one message per completed turn that produced output. A turn that
  produces no message (silent reply, stopped before output) leaves no timeline unit behind.
- Two agents answering concurrently are two evolving contributions, one per seat. Interleaved
  execution order never changes the shape of the conversation.

## Timeline Contract

- The chat timeline projection (`chat.log.list`) returns conversation units only: participant
  messages and chat-level system events (membership changes, day boundaries, delivery notices
  that are themselves conversation-visible).
- Execution evidence rows — tool calls, reasoning, narration activity, turn lifecycle status —
  do not appear in the timeline projection.
- Every timeline unit renders at its natural size. The timeline never contains units that render
  empty; even spacing between messages is a structural guarantee, not a filtering outcome.
- Agent messages carry their turn identity (`runId`, response id) as first-class fields so the
  app can associate a message with its turn without deriving identity from row-id shapes.
- The app maps timeline units to rendered comments one-to-one. The app does not group, merge,
  or suppress timeline rows to reconstruct turn structure.

## Posts: A Turn's Message Is Created At First Content

- The timeline is append-only from the reader's seat: a new unit only ever appears at the end,
  and no unit ever moves. This is a storage guarantee, not a client sorting policy.
- The moment a turn first produces visible content — its first narration or first streamed reply
  text — Runtime creates the turn's real chat message row (`createPost`). The row's sequence
  fixes its timeline position permanently. Turn start time never determines position; a turn
  that works silently in tools has no timeline presence until it says something.
- Everything after is an edit to that post (`editPost`): narration supersession, streamed reply
  text, and the final content are content updates to the same message row, delivered live over
  turn events and settled durably at turn end. Completion links the delivery to the same message
  id; stop and failure settle the post with the last content it showed.
- Before a turn has content, it appears only in the status stack (`activeReplies` presentation
  state) — thinking is not a timeline unit.
- Two agents answering concurrently produce posts ordered by who spoke first, regardless of
  which turn started first or finished first.

## Turn Evidence Contract

- Turn evidence is queried per turn (by run or response id), not embedded in the timeline.
- The turn drawer, prompt evidence, and any future execution views read from turn-scoped
  queries. These load on demand; opening a chat never pays for evidence it does not show.
- Evidence preserves execution order within its turn, including tool status transitions,
  narration supersession, and failure detail.
- Evidence rows carry run identity as first-class fields. Consumers never parse ids to recover
  which turn owns a row.

## Boundaries

- Runtime owns both models: canonical messages and durable turn records. The separation is a
  projection contract, not a storage change.
- The server exposes the two models through separate procedures with separate schemas. A change
  to evidence shape must not alter the timeline contract, and vice versa.
- External frontends (Discord, SDK clients) consume the timeline contract. Turn evidence is a
  first-party product surface and may evolve faster.

## Migration Notes (in flight)

- Today `chat.log.list` mixes evidence rows into the timeline and the app reconstructs turns by
  grouping rows client-side. That grouping (consecutive-run scans, run-id derivation from row
  ids, pane-segment filtering) is retired by this contract, not repaired.
- The drawer currently feeds from grouped timeline rows; it moves to a turn-scoped evidence
  query. The per-turn prompt-evidence query is the existing precedent for this shape.
- Deterministic e2e specs assert drawer content through the evidence query and timeline shape
  through the timeline contract, not one mixed projection.
