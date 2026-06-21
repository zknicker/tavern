# Chat Scroll Controller (Plan A)

Status: implemented (`chat-scroll-mode.ts` + `use-chat-scroll-controller.ts`).
Consolidates app-owned chat scroll writes into one controller so the recurring
animation-hitch bug class becomes structurally impossible. Virtualized
transcripts let TanStack Virtual own item measurement compensation, prepend
anchoring, pinned-end anchoring, and follow-on-append. Notes from the
implementation: the controller attaches its own viewport listeners (scroll,
wheel, touchmove, transitionend) instead of exposing `handleScroll`, so no
consumer can forget one; the 12-frame initial scroll loop was deleted —
initial `following` mode plus content ResizeObserver re-pins settle the first
render; the manual 120Hz feel-test below remains the final gate.

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

One controller owns app-issued `scrollTop` writes. TanStack Virtual owns
virtualized measurement and range adjustments. Explicit modes:

| Mode | Entered when | Who may write scrollTop |
| --- | --- | --- |
| `following` | near bottom (72px tolerance); also the initial mode | controller pins bottom on every content resize |
| `anchored` | pointer-down/keydown on a disclosure trigger | controller pins the trigger's viewport Y each frame |
| `free` | user scrolls up | nobody from Tavern — TanStack Virtual may apply its default compensation for items above the viewport |

`anchored` exits on a bubbling `transitionend` (`propertyName === 'height'`)
reaching the viewport, +1 frame, with a ~600ms time fallback for reduced
motion. User wheel/touch input during an anchor cancels it — user intent wins.

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

Virtualized transcript rule: leave TanStack Virtual's
`shouldAdjustScrollPositionOnItemSizeChange` undefined during normal scrolling
so the library keeps its backward-scroll guard. Set a suppressing predicate
only while Tavern disclosure anchoring is active.

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
