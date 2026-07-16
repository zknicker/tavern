# 011 — Hardware-accelerated row transforms + entry stagger

- **Status**: DONE
- **Commit**: 3ad8af77
- **Severity**: LOW
- **Category**: Performance + Cohesion (stagger)
- **Estimated scope**: 2 files, ~20 lines

## Problem

1. `StatusRiseRow`'s inner layer animates Framer Motion `scale`/`y`
   shorthands, which run on the main thread — and these rows animate exactly
   when the main thread is busiest (streaming markdown re-renders). The full
   `transform` string is hardware-accelerated.
2. When several agents are dispatched at once, all rows mount in the same
   frame with zero stagger — everything-at-once instead of a cascade.

```tsx
// apps/website/src/features/chats/chat-status-motion.tsx:50 — current
<motion.div
    animate={{ scale: 1, y: 0 }}
    className={innerClassName}
    exit={reduceMotion ? undefined : { scale: 0.97, transition: riseOut, y: -6 }}
    initial={reduceMotion ? false : { scale: 0.96, y: 10 }}
    style={{ transformOrigin: 'left center' }}
    transition={riseIn}
>
```

## Target

Animate one `transform` string (identical structure across targets so springs
interpolate per-number), and accept an optional enter delay:

```tsx
// target — StatusRiseRow gains an enterDelaySeconds?: number prop (default 0)
<motion.div
    animate={{ transform: 'translateY(0px) scale(1)' }}
    className={innerClassName}
    exit={
        reduceMotion
            ? undefined
            : { transform: 'translateY(-6px) scale(0.97)', transition: statusRiseOut }
    }
    initial={reduceMotion ? false : { transform: 'translateY(10px) scale(0.96)' }}
    style={{ transformOrigin: 'left center' }}
    transition={{ ...riseIn, delay: enterDelaySeconds }}
>
```

The outer layer's height/opacity enter transition gets the same
`delay: enterDelaySeconds` (exit stays undelayed) so the clip doesn't open
onto an empty gap. The stack passes a 50ms cascade:

```tsx
// chat-active-status-stack.tsx — rows map gains the index
{seatReplies.map((reply, index) => (
    <StatusRiseRow
        className="-ms-2"
        enterDelaySeconds={index * 0.05}
        innerClassName="py-0.5 ps-2"
        key={reply.agentId}
    >
```

Stagger stays 50ms per row (AUDIT range 30–80ms), is enter-only, and never
delays exits. `AnimatePresence initial={false}` already suppresses it on
first mount of a chat.

## Repo conventions to follow

- Keep the exact spring configs already in `chat-status-motion.tsx`
  (`riseIn = { bounce: 0.2, duration: 0.3, type: 'spring' }`); only the
  animated property representation changes.
- `transformOrigin` stays a `style` prop.

## Steps

1. In `chat-status-motion.tsx`, add `enterDelaySeconds = 0` to
   `StatusRiseRow`'s props; convert the inner layer's `initial`/`animate`/
   `exit` to the `transform` strings above; spread the delay into the inner
   `riseIn` transition and the outer enter transition
   (`transition={{ height: { ...clip, delay: enterDelaySeconds }, opacity: { delay: enterDelaySeconds, duration: 0.18, ease: 'easeOut' } }}`).
   Exit transitions keep no delay.
2. In `chat-active-status-stack.tsx`, pass `enterDelaySeconds={index * 0.05}`
   from the rows map.
3. The busy-elsewhere hint (`agent-presence.tsx`) passes nothing — a single
   row needs no stagger.

## Boundaries

- Do NOT change spring durations/bounce values or the dwell hold.
- Do NOT stagger exits.
- If the excerpt has drifted, STOP and report.

## Verification

- **Mechanical**: `cd apps/website && bun run typecheck && bun run test`; root
  `bun run lint`.
- **Feel check**: message a channel with two agents; the second row lands one
  beat (~50ms) after the first — a cascade, not a block. At 10% playback the
  inner layer still rises with a slight overshoot (springs interpolate the
  transform string per-number; if the overshoot is gone, the string structures
  don't match — fix the strings, don't switch back to shorthands).
- **Done when**: no `scale:`/`y:` shorthand targets remain in
  `chat-status-motion.tsx` and multi-row entries cascade.
