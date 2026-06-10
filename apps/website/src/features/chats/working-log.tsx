import { ArrowDown01Icon } from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import {
    Collapsible,
    CollapsiblePanel,
    CollapsibleTrigger,
} from '../../components/ui/collapsible.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { cn } from '../../lib/utils.ts';
import { ActivityStep } from './chat-transcript-activity-step.tsx';
import {
    type ActivityItem,
    formatActiveActivitySeconds,
    formatActivityHeader,
    formatWorkGroupHeader,
    getActiveWorkLabel,
    getActivityItemKey,
} from './chat-transcript-activity-utils.ts';
import {
    dispatchTranscriptDisclosureAnchorEnd,
    dispatchTranscriptDisclosureAnchorStart,
} from './chat-transcript-scroll-anchor.ts';
import { ThinkingSteps, ThinkingStepsContent, ThinkingStepsHeader } from './thinking-steps.tsx';

export function WorkingLog({
    chatId,
    currentSessionKey,
    end,
    items,
    showDurationHeader = true,
    start,
    status,
}: {
    chatId?: string;
    currentSessionKey?: string | null;
    end: string | null;
    items: ActivityItem[];
    showDurationHeader?: boolean;
    start: string | null;
    status: 'active' | 'completed';
}) {
    const isActive = status === 'active';
    // Group mode (no duration header) renders Codex-style: collapsed by
    // default with a live summary label while the group is executing.
    const groupMode = !showDurationHeader;
    const now = useNow(isActive && start !== null, start);
    const activeSeconds = isActive ? formatActiveActivitySeconds({ now, start }) : null;
    const thinkingOnly = isThinkingOnly(items);
    const defaultOpen = groupMode ? false : isActive || (!thinkingOnly && hasNarration(items));
    const [open, setOpen] = React.useState(defaultOpen);
    const disclosureAnchor = useDisclosureScrollAnchor();

    React.useEffect(() => {
        if (groupMode) {
            return;
        }

        if (isActive) {
            setOpen(true);
            return;
        }

        if (thinkingOnly) {
            setOpen(false);
        }
    }, [groupMode, isActive, thinkingOnly]);

    const handleOpenChange = (nextOpen: boolean) => {
        setOpen(nextOpen);
        disclosureAnchor.preserve();
    };
    const groupLabel = groupMode
        ? isActive
            ? (getActiveWorkLabel(items) ?? 'Working')
            : formatWorkGroupHeader(items)
        : null;

    return (
        <ThinkingSteps
            // Group mode: the trigger's py-1 click padding must not stack onto
            // the surrounding 16px block rhythm.
            className={cn('w-full max-w-[34rem]', groupMode && '-my-1')}
            onOpenChange={handleOpenChange}
            open={open}
        >
            <ThinkingStepsHeader
                onKeyDown={disclosureAnchor.captureFromKeyboard}
                onPointerDown={disclosureAnchor.capture}
                ref={disclosureAnchor.triggerRef}
            >
                {groupMode ? (
                    <span
                        className={cn(
                            'inline-block max-w-[28rem] truncate align-bottom',
                            isActive && 'thinking-indicator-text'
                        )}
                    >
                        {groupLabel}
                    </span>
                ) : isActive && activeSeconds ? (
                    <span>
                        Working for{' '}
                        <span className="inline-block min-w-[2.2ch] text-left tabular-nums">
                            {activeSeconds}
                        </span>
                    </span>
                ) : (
                    formatActivityHeader({ end, isActive, now, start })
                )}
            </ThinkingStepsHeader>
            <ThinkingStepsContent className={showDurationHeader ? undefined : 'pt-1'}>
                {items.map((item, index) => (
                    <ActivityStep
                        animateEnter={isActive}
                        chatId={chatId}
                        currentSessionKey={currentSessionKey}
                        index={index}
                        isLast={index === items.length - 1}
                        item={item}
                        key={getActivityItemKey(item)}
                    />
                ))}
            </ThinkingStepsContent>
        </ThinkingSteps>
    );
}

function useDisclosureScrollAnchor() {
    const triggerRef = React.useRef<HTMLButtonElement | null>(null);
    const anchorRef = React.useRef<{
        endAtMs: number;
        frameId: number | null;
        scrollParent: HTMLElement | null;
        top: number;
        trigger: HTMLButtonElement;
    } | null>(null);

    const capture = React.useCallback(() => {
        const trigger = triggerRef.current;

        if (!trigger) {
            return;
        }

        if (anchorRef.current?.frameId !== null && anchorRef.current?.frameId !== undefined) {
            cancelAnimationFrame(anchorRef.current.frameId);
        }

        anchorRef.current = {
            endAtMs: performance.now() + disclosureAnchorDurationMs,
            frameId: null,
            scrollParent: getScrollParent(trigger),
            top: trigger.getBoundingClientRect().top,
            trigger,
        };
        dispatchTranscriptDisclosureAnchorStart();
    }, []);

    const captureFromKeyboard = React.useCallback(
        (event: React.KeyboardEvent<HTMLButtonElement>) => {
            if (event.key === 'Enter' || event.key === ' ') {
                capture();
            }
        },
        [capture]
    );

    const preserve = React.useCallback(() => {
        const anchor = anchorRef.current;

        if (!anchor) {
            return;
        }

        const preserveFrame = () => {
            const currentAnchor = anchorRef.current;

            if (!currentAnchor) {
                return;
            }

            const nextTop = currentAnchor.trigger.getBoundingClientRect().top;
            const delta = nextTop - currentAnchor.top;

            if (Math.abs(delta) >= 0.5) {
                if (currentAnchor.scrollParent) {
                    currentAnchor.scrollParent.scrollTop += delta;
                } else {
                    window.scrollBy({ top: delta });
                }
            }

            if (performance.now() >= currentAnchor.endAtMs) {
                anchorRef.current = null;
                dispatchTranscriptDisclosureAnchorEnd();
                return;
            }

            currentAnchor.frameId = requestAnimationFrame(preserveFrame);
        };

        anchor.frameId = requestAnimationFrame(preserveFrame);
    }, []);

    React.useEffect(
        () => () => {
            if (anchorRef.current?.frameId !== null && anchorRef.current?.frameId !== undefined) {
                cancelAnimationFrame(anchorRef.current.frameId);
            }

            if (anchorRef.current) {
                dispatchTranscriptDisclosureAnchorEnd();
            }
        },
        []
    );

    return { capture, captureFromKeyboard, preserve, triggerRef };
}

// Time-based, NOT frame-based: frame counts halve on 120Hz displays, which
// made the anchor expire mid-animation. Must outlast the
// chat-collapsible-panel height transition (240ms) plus settle frames.
const disclosureAnchorDurationMs = 420;
const completedCollapseDelayMs = 650;

function getScrollParent(element: HTMLElement): HTMLElement | null {
    let parent = element.parentElement;

    while (parent) {
        const style = window.getComputedStyle(parent);
        const canScroll = /(auto|scroll|overlay)/.test(style.overflowY);

        if (canScroll && parent.scrollHeight > parent.clientHeight) {
            return parent;
        }

        parent = parent.parentElement;
    }

    return null;
}

export function TurnWorkDisclosure({
    children,
    end,
    start,
    status,
}: {
    children: React.ReactNode;
    end: string | null;
    start: string | null;
    status: 'active' | 'completed';
}) {
    const isActive = status === 'active';
    // Open while the turn works; collapse once with an animation when it
    // completes. The collapse waits a beat so the final reply finishes
    // revealing and the completion refetch settles first — animating while
    // the panel's contents are still changing reads as a stutter. Completed
    // turns start collapsed so history reads the same way a finished live
    // turn does. Users can re-open at any time.
    const [open, setOpen] = React.useState(isActive);
    const wasActiveRef = React.useRef(isActive);
    // Manual toggles anchor the trigger so the panel expands downward even
    // when the chat is bottomed out; the completion auto-collapse stays
    // unanchored so bottom-follow keeps the reply pinned instead.
    const disclosureAnchor = useDisclosureScrollAnchor();

    React.useEffect(() => {
        if (isActive) {
            wasActiveRef.current = true;
            setOpen(true);
            return;
        }

        if (!wasActiveRef.current) {
            return;
        }

        wasActiveRef.current = false;
        const timer = window.setTimeout(() => setOpen(false), completedCollapseDelayMs);

        return () => window.clearTimeout(timer);
    }, [isActive]);

    const handleOpenChange = (nextOpen: boolean) => {
        setOpen(nextOpen);
        disclosureAnchor.preserve();
    };

    return (
        <Collapsible className="flex min-w-0 flex-col" onOpenChange={handleOpenChange} open={open}>
            <CollapsibleTrigger
                className="group border-border/70 border-b pb-2 text-left font-medium text-[13px] text-muted-foreground leading-tight transition-colors hover:text-foreground"
                onKeyDown={disclosureAnchor.captureFromKeyboard}
                onPointerDown={disclosureAnchor.capture}
                ref={disclosureAnchor.triggerRef}
            >
                <span className="inline-flex items-center gap-1.5">
                    <TurnWorkHeaderContent end={end} start={start} status={status} />
                    <Icon
                        className="size-3.5 -rotate-90 transition-transform group-data-[panel-open]:rotate-0"
                        icon={ArrowDown01Icon}
                        strokeWidth={1.7}
                    />
                </span>
            </CollapsibleTrigger>
            <CollapsiblePanel className="chat-collapsible-panel" keepMounted>
                {/* Spacing lives inside the animated panel so it collapses with
                    the height instead of vanishing in one frame at the end. */}
                <div className="flex min-w-0 flex-col gap-4 pt-3.5">{children}</div>
            </CollapsiblePanel>
        </Collapsible>
    );
}

function TurnWorkHeaderContent({
    end,
    start,
    status,
    wrapperClassName,
}: {
    end: string | null;
    start: string | null;
    status: 'active' | 'completed';
    wrapperClassName?: string;
}) {
    const isActive = status === 'active';
    const now = useNow(isActive && start !== null, start);
    const activeSeconds = isActive ? formatActiveActivitySeconds({ now, start }) : null;

    return (
        <span className={wrapperClassName}>
            {isActive && activeSeconds ? (
                <span>
                    Working for{' '}
                    <span className="inline-block min-w-[2.2ch] text-left tabular-nums">
                        {activeSeconds}
                    </span>
                </span>
            ) : (
                formatActivityHeader({ end, isActive, now, start })
            )}
        </span>
    );
}

function hasNarration(items: ActivityItem[]) {
    return items.some((item) => {
        if (item.row.kind === 'system') {
            return false;
        }

        if (item.row.kind !== 'tool') {
            return false;
        }

        const name = item.row.toolCall.name.trim().toLowerCase();
        return name === 'message' || name === 'reasoning';
    });
}

function isThinkingOnly(items: ActivityItem[]) {
    return (
        items.length > 0 &&
        items.every((item) => item.row.kind === 'system' && item.row.systemKind === 'thinking')
    );
}

function useNow(enabled: boolean, start: string | null) {
    const [now, setNow] = React.useState(() => Date.now());

    React.useEffect(() => {
        if (!enabled) {
            return;
        }

        const updateNow = () => setNow(Date.now());
        const startMs = start ? Date.parse(start) : Number.NaN;
        const elapsedMs = Number.isNaN(startMs) ? 0 : Math.max(0, Date.now() - startMs);
        const delayMs = Number.isNaN(startMs) ? 1000 : 1000 - (elapsedMs % 1000);
        let interval: number | undefined;

        updateNow();

        const timeout = window.setTimeout(
            () => {
                updateNow();
                interval = window.setInterval(updateNow, 1000);
            },
            Math.max(100, delayMs)
        );

        return () => {
            window.clearTimeout(timeout);

            if (interval !== undefined) {
                window.clearInterval(interval);
            }
        };
    }, [enabled, start]);

    return now;
}
