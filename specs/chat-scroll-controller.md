# Chat Scroll Controller (Plan A)

Status: implemented (`chat-scroll-mode.ts` + `use-chat-scroll-controller.ts` +
`chat-scroll-animation.ts`).
Consolidates app-owned chat scroll writes into one controller so the recurring
animation-hitch bug class becomes structurally impossible. Virtualized
transcripts let TanStack Virtual own item measurement compensation, prepend
anchoring, pinned-end anchoring, and follow-on-append. Notes from the
implementation: the controller attaches its own viewport listeners (scroll,
wheel, touchmove, transitionend) instead of exposing `handleScroll`, so no
consumer can forget one; the 12-frame initial scroll loop was deleted; the
manual 120Hz feel-test below remains the final gate.

## Problem

Four systems write the chat viewport's `scrollTop`, coordinated by window
events and timing constants:

1. Bottom-follow via ResizeObserver — `apps/website/src/features/chats/use-chat-scroll.ts`
2. `useDisclosureScrollAnchor` — `apps/website/src/features/chats/working-log.tsx`
   (420ms time-based rAF loop; signals through
   `chat-transcript-scroll-anchor.ts` window events)
3. `shouldAdjustScrollPositionOnItemSizeChange` —
   `apps/website/src/features/chats/virtualized-chat-transcript.tsx`
   (disabled while anchored or near bottom via `isNearViewportBottom`)
4. A 12-frame initial scroll-to-end loop in the same file

Coordination is by timing guesses. Frame counts halve on 120Hz displays
(already converted to time-based as a stopgap); every fix rebalances a truce
instead of removing the race.

## Design

One controller owns user intent and non-virtualized app-issued `scrollTop`
writes. TanStack Virtual owns virtualized measurement, range adjustments, and
passive follow reconciliation in the detailed transcript. Explicit modes:

| Mode | Entered when | Who may write scrollTop |
| --- | --- | --- |
| `following` | near bottom (48px tolerance); also the initial mode | controller pins non-virtual content resizes; virtualized transcript reconciles measured end |
| `anchored` | pointer-down/keydown on a disclosure trigger | controller pins the trigger's viewport Y each frame |
| `free` | user-initiated scrolls move away from bottom | nobody from Tavern — TanStack Virtual may apply its default compensation for items above the viewport |

`following` treats passive scroll drift as layout/measurement drift and re-pins
the bottom instead of leaving follow mode. In virtualized detailed chats, the
controller tracks that mode but does not perform the passive drift write; the
virtualizer does, so TanStack remains the only passive follow writer for
measured rows. Wheel, touch, scrollbar, and keyboard scroll intent is
short-lived and applies to the next scroll event. `anchored` exits on a
bubbling `transitionend` (`propertyName === 'height'`) reaching the viewport,
+1 frame, with a ~600ms time fallback for reduced motion. User scroll input
during an anchor cancels it — user intent wins.

Two files:

1. `chat-scroll-mode.ts` — PURE transition function `(mode, event) → (mode,
   action)`, bun:test covered. Known regressions become test cases: anchor
   active + resize → no follow write; auto-collapse at bottom → following
   keeps reply pinned; collapse anchored at scrollTop 0 → no write; user
   scroll during anchor → cancel.
2. `use-chat-scroll-controller.ts` — thin DOM layer (viewport/content refs,
   ResizeObserver, scroll + transitionend listeners) exposing
   `{ isAtBottom, scrollToBottom, beginAnchor }` through a React context so
   deep components reach it without window events.
3. `chat-scroll-animation.ts` — shared DOM-side follow animation for controller
   and virtualizer writes. TanStack calls still use `behavior: 'auto'`; the DOM
   animation starts its clock on the first animation frame and caps per-frame
   catch-up so a delayed table render cannot turn into one visible jump.

Virtualized transcript rule: while `following`, pass TanStack Virtual a size
adjustment predicate that accepts row growth and shrinkage, including late
growth inside the last row. This keeps active presence and Rich Response tail
content pinned after the row was already rendered. While `free`, leave the
predicate undefined so the library keeps its backward-scroll guard. While
`anchored`, set a suppressing predicate so disclosure anchoring owns the
scroll offset. The virtualized transcript also reconciles to TanStack's
measured end from both React-rendered `getTotalSize()` changes and the
virtualizer `onChange` callback while following; the callback path matters
because direct DOM updates can apply late browser/renderer measurements without
a React render. Follow-on-append stays `auto`: TanStack's smooth state skips
item-size compensation, which is the wrong tradeoff for streaming text and
Rich Responses that keep growing after the row exists.

Virtualized detail chats also keep process-local scroll memory keyed by chat.
The stored value is either `atBottom` or the first visible transcript row id
plus its offset. On remount, the row anchor restores before the initial
scroll-to-bottom path; missing rows fall back to bottom so stale anchors never
strand the viewport. `atBottom` snapshots use the virtualizer's measured end
state, not the app scroll mode, because scroll mode can lag the physical
viewport by one scroll callback. Nonzero row-offset restores wait until the
scroll element has nonzero scroll capacity; calling TanStack `scrollToOffset`
before that would clamp the target through a max offset of `0` and land at the
top.

## Migration steps

1. Build controller + pure tests (no consumers touched).
2. Migrate `chat-detail-frame.tsx` (replaces `use-chat-scroll.ts`) and
   `virtualized-chat-transcript.tsx` (virtualizer adjust → controller; delete
   local anchor-event listeners).
3. Migrate `working-log.tsx`: BOTH triggers (TurnWorkDisclosure and WorkingLog
   group headers) call `beginAnchor` via context. The completion auto-collapse
   must stay UNanchored so bottom-follow pins the reply. Delete
   `useDisclosureScrollAnchor` and `chat-transcript-scroll-anchor.ts`.
4. Hypothesis: initial mode `following` makes the 12-frame initial loop
   unnecessary (each virtualizer measurement growth triggers a follow write
   until settled). Validate; delete if confirmed.
5. Update `docs/features/chat.md` ("Live turn presentation" scroll bullet) and
   `docs/internals/react.md` if the context pattern is convention-worthy.

## Regression checklist (sign-off matrix)

Initial open lands at bottom · new turn scrolls to bottom from anywhere
(`followKey`) · jump-button visibility · streaming follows at bottom, never
yanks when scrolled up · auto-collapse stays bottom-pinned · manual
expand/collapse pins the trigger at top/middle/bottom · history page-load
prepend does not shift the view · reduced-motion anchors end via fallback.

Manual feel-testing on a 120Hz display is the final gate.

## Verification

`bun test src`, `tsc --noEmit`, `ultracite check` in apps/website.
