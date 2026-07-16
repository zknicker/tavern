# 012 — Crossfade status label and work-icon changes; soften presence dots

- **Status**: DONE
- **Commit**: 3ad8af77
- **Severity**: LOW (missed opportunities)
- **Category**: Missed opportunities / Cohesion
- **Estimated scope**: 3 files, ~60 lines

## Problem

1. The primary status label — the most-watched text in the surface —
   hard-swaps between states ("Otto is thinking..." → "Otto is typing..." →
   "Otto is wrapping up in Launch Prep"), while the *secondary* work summary
   beside it gets a SlotText roll. State changes teleport.
2. The work-group icon beside the summary swaps instantly when the tool
   category changes.
3. Presence dots snap between `bg-warning` (busy) and `bg-success` (idle).

```tsx
// apps/website/src/features/chats/chat-active-status-stack.tsx:257 — current
<span className="thinking-indicator-text min-w-0 shrink-0 leading-5">
    {formatActiveStatusText({ activeReply, agentName, queuedElsewhere, rows })}
</span>
{stableSummary ? (
    <span className="flex h-5 min-w-0 items-center gap-1.5 ...">
        {workIcon ? (
            <Icon className="size-3.5 shrink-0" icon={workIcon} strokeWidth={1.5} />
        ) : null}
        <WorkGroupHeaderText isActive label={stableSummary} />
    </span>
) : null}
```

```tsx
// apps/website/src/features/chats/agent-presence.tsx:131 — current
<span
    aria-hidden="true"
    className={cn(
        'size-2 shrink-0 rounded-full',
        state === 'busy' ? 'bg-warning' : 'bg-success',
        className
    )}
    data-state={state}
/>
```

## Target

A shared blur-masked crossfade in `chat-status-motion.tsx` — old and new
content overlap in one grid cell so nothing reflows, 2px blur masks the
double exposure (AUDIT §7):

```tsx
/** Blur-masked crossfade for small status content (labels, icons). */
export function StatusSwap({
    children,
    className,
    swapKey,
}: {
    children: React.ReactNode;
    className?: string;
    swapKey: string;
}) {
    const reduceMotion = useReducedMotion() === true;

    return (
        <span className={cn('grid', className)}>
            <AnimatePresence initial={false}>
                <motion.span
                    animate={{ filter: 'blur(0px)', opacity: 1 }}
                    className="col-start-1 row-start-1"
                    exit={{
                        filter: 'blur(2px)',
                        opacity: 0,
                        transition: { duration: 0.12, ease: 'easeOut' },
                    }}
                    initial={reduceMotion ? false : { filter: 'blur(2px)', opacity: 0 }}
                    key={swapKey}
                    transition={{ duration: 0.15, ease: 'easeOut' }}
                >
                    {children}
                </motion.span>
            </AnimatePresence>
        </span>
    );
}
```

- Label use: `swapKey` = the label string. The shimmer class
  `thinking-indicator-text` moves ONTO the inner `motion.span`'s children —
  `background-clip: text` must not sit above a filtered descendant, so the
  shimmer is applied per swapped span (pass it via a `contentClassName` that
  StatusSwap puts on the motion.span, or wrap the text in a span carrying the
  class inside the swap). The outer layout span keeps
  `min-w-0 shrink-0 leading-5`.
- Icon use: `swapKey` derived from the icon's identity. Hugeicons icons are
  module-constant objects, so a `WeakMap<object, string>` counter in
  `chat-status-motion.tsx` (`export function statusSwapKeyFor(value: object)`)
  gives a stable key.
- Presence dots: add `transition-colors duration-300` to the `cn(...)` list in
  `AgentPresenceDot` (`agent-presence.tsx`) and the hover-card dot
  (`agent-hover-card.tsx:114`, `'size-2 shrink-0 rounded-full'`).

## Repo conventions to follow

- Status-surface motion lives in `chat-status-motion.tsx`; the swap component
  belongs there.
- The exit is faster than the enter (120ms vs 150ms) — matches the surface's
  asymmetric timing.
- Blur stays at 2px (AUDIT §5: keep transition blur small).

## Steps

1. Add `StatusSwap` and `statusSwapKeyFor` to `chat-status-motion.tsx`
   (imports: `AnimatePresence`, `motion`, `useReducedMotion`, `cn`).
2. In `ChatActiveStatusItem` (`chat-active-status-stack.tsx`), compute
   `const statusText = formatActiveStatusText(...)` once; replace the label
   span with
   `<StatusSwap className="min-w-0 shrink-0 leading-5" swapKey={statusText}><span className="thinking-indicator-text whitespace-nowrap">{statusText}</span></StatusSwap>`.
3. Replace the bare `<Icon .../>` with
   `<StatusSwap className="size-3.5 shrink-0" swapKey={statusSwapKeyFor(workIcon)}><Icon className="size-3.5" icon={workIcon} strokeWidth={1.5} /></StatusSwap>`.
4. Add `transition-colors duration-300` to both presence-dot class lists.
5. Update `chat-active-status-stack.test.tsx` expectations if markup asserts
   exact class adjacency (the tests match on text and
   `thinking-indicator-text`, which both survive).

## Boundaries

- Do NOT touch `WorkGroupHeaderText`/SlotText — the summary roll is already
  right.
- Do NOT animate the row's width; the grid overlay is the whole trick.
- Do NOT exceed 2px blur.
- If excerpts have drifted, STOP and report.

## Verification

- **Mechanical**: `cd apps/website && bun run typecheck && bun run test`; root
  `bun run lint`.
- **Feel check**: simulate a turn and watch thinking → typing: the label melts
  between states (no hard swap, no width jump taller than the overlap); the
  shimmer still plays on the label; at 10% playback confirm exactly two
  overlapping texts blurred into one impression, never two crisp copies.
  Toggle reduced motion: swaps become plain replaces (no blur/fade on enter).
- **Done when**: label, icon, and dot changes all transition; tests green.
