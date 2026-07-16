# 009 — Anchor the busy-elsewhere hint's scale to its content column

- **Status**: DONE
- **Commit**: 3ad8af77
- **Severity**: MEDIUM
- **Category**: Physicality & origin
- **Estimated scope**: 1 file, ~15 lines restructured

## Problem

`AgentBusyElsewhereHint` wraps its **full-viewport-width** gutter div in the
animated `StatusRiseRow`, whose inner layer scales 0.96 → 1 with
`transform-origin: left center`. Scaling a full-width element from its far-left
edge translates the centered content sideways (tens of px at wide viewports),
so the hint enters with a lateral lurch instead of a gentle rise.

```tsx
// apps/website/src/features/chats/agent-presence.tsx:74 — current
return (
    <AnimatePresence initial={false}>
        {visible ? (
            <StatusRiseRow key={busyElsewhere.agentId}>
                <div className="px-6 lg:px-16" data-slot="agent-busy-elsewhere">
                    <div className="mx-auto flex w-full max-w-[60rem] items-center gap-1.5 px-1 pb-1.5 text-muted-foreground text-xs">
                        ...
                    </div>
                </div>
            </StatusRiseRow>
        ) : null}
    </AnimatePresence>
);
```

## Target

The gutter + centered column stay static; only the content row inside the
60rem column animates. `transform-origin: left center` then anchors at the
column's left edge — flush with the prompt bar — matching the status stack,
whose rows already animate inside their centered column.

```tsx
// target
return (
    <div className="px-6 lg:px-16" data-slot="agent-busy-elsewhere">
        <div className="mx-auto w-full max-w-[60rem]">
            <AnimatePresence initial={false}>
                {visible ? (
                    <StatusRiseRow key={busyElsewhere.agentId}>
                        <div className="flex items-center gap-1.5 px-1 pb-1.5 text-muted-foreground text-xs">
                            <Icon aria-hidden="true" className="size-3.5 shrink-0" icon={Clock} />
                            <span className="min-w-0 truncate">
                                {agentName} is busy{formatWhere(busyElsewhere)} — your message is
                                queued and answers next
                            </span>
                        </div>
                    </StatusRiseRow>
                ) : null}
            </AnimatePresence>
        </div>
    </div>
);
```

The always-mounted wrappers have horizontal padding only, so they contribute
zero height while the hint is hidden.

## Repo conventions to follow

- Exemplar: `apps/website/src/features/chats/chat-active-status-stack.tsx`
  renders `StatusRiseRow` inside `<div className="mx-auto flex w-full max-w-[60rem] flex-col">`.
- The `pb-1.5` bottom padding must live **inside** the animated row so the
  height clip collapses it.

## Steps

1. In `apps/website/src/features/chats/agent-presence.tsx`, restructure
   `AgentBusyElsewhereHint`'s return to the target above: static gutters +
   static centered column outside `AnimatePresence`, `StatusRiseRow` wrapping
   only the content flex row.

## Boundaries

- Do NOT touch `StatusRiseRow` or `chat-status-motion.tsx`.
- Do NOT change the hint's copy, `data-slot`, or visibility logic.
- If the current code no longer matches the excerpt, STOP and report.

## Verification

- **Mechanical**: `cd apps/website && bun run typecheck && bun run test` — all green;
  root `bun run lint` clean.
- **Feel check**: open a DM whose agent is busy in another chat; the hint rises
  in place under the composer edge with no horizontal drift. In DevTools set
  animation playback to 10% and confirm the text does not slide left/right
  while scaling.
- **Done when**: the hint's animated element is the flex row inside the 60rem
  column and the enter shows no lateral movement.
