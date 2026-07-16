# 010 — Fade the status section; one spring vocabulary for the surface

- **Status**: DONE
- **Commit**: 3ad8af77
- **Severity**: MEDIUM (exit direction) + LOW (token consolidation)
- **Category**: Cohesion (spatial + tokens)
- **Estimated scope**: 2 files, ~10 lines

## Problem

When the last status row settles, the section wrapper exits with `y: +4`
(drifting **down**) at the same moment the row inside exits with `y: -6`
(floating **up**) — two nested containers moving opposite directions in one
gesture. The section also uses `springs.moderate` (0.16s) while the rows use
the status-motion springs (0.2–0.3s), two spring vocabularies in one surface.

```tsx
// apps/website/src/features/chats/chat-active-status-stack.tsx:102 — current
<motion.section
    animate={{ opacity: 1 }}
    ...
    exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
    initial={{ opacity: 0 }}
    key="active-status"
    transition={springs.moderate}
>
```

## Target

The section only fades; the row's own motion carries direction. Its
transition comes from the shared status-motion constants.

```tsx
// target
<motion.section
    animate={{ opacity: 1 }}
    ...
    exit={{ opacity: 0 }}
    initial={{ opacity: 0 }}
    key="active-status"
    transition={statusRiseOut}
>
```

with `chat-status-motion.tsx` exporting its exit spring:

```tsx
/** Exit: quicker settle, no bounce — the system responding, not performing. */
export const statusRiseOut = { bounce: 0, duration: 0.2, type: 'spring' } as const;
```

(rename the local `riseOut` const; update its two internal uses).

## Repo conventions to follow

- Status-surface motion constants live in
  `apps/website/src/features/chats/chat-status-motion.tsx` (`riseIn`,
  `riseOut`, `clip`). Extend that file; do not add new configs to
  `apps/website/src/lib/springs.ts`.

## Steps

1. In `chat-status-motion.tsx`, rename `riseOut` → `statusRiseOut` and export
   it. Update the two references inside `StatusRiseRow`.
2. In `chat-active-status-stack.tsx`, import `statusRiseOut` from
   `./chat-status-motion.tsx`; change the `motion.section` `exit` to
   `{{ opacity: 0 }}` (drop the `reduceMotion` ternary — fade-only is correct
   for both) and `transition` to `statusRiseOut`.
3. Remove the `springs` import from `chat-active-status-stack.tsx` if it is
   now unused (it is — the section was its only consumer). Remove the
   `useReducedMotion` usage too if the section exit was its last consumer;
   check before deleting.

## Boundaries

- Do NOT change the row-level (`StatusRiseRow`) enter/exit values.
- Do NOT touch `lib/springs.ts`.
- If the excerpts have drifted, STOP and report.

## Verification

- **Mechanical**: `cd apps/website && bun run typecheck && bun run test`; root
  `bun run lint`.
- **Feel check**: trigger a turn (Dev toolbar → simulate turn), let it settle;
  at 10% playback the last row floats up and away while the gradient section
  fades in place — nothing moves downward.
- **Done when**: section exit has no `y` component and its transition is
  `statusRiseOut`.
