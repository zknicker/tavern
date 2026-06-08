import { ArrowDown01Icon } from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import {
    Collapsible,
    CollapsiblePanel,
    CollapsibleTrigger,
} from '../../components/ui/collapsible.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { ActivityStep } from './chat-transcript-activity-step.tsx';
import {
    type ActivityItem,
    formatActiveActivitySeconds,
    formatActivityHeader,
    formatWorkGroupHeader,
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
    const now = useNow(isActive && start !== null, start);
    const activeSeconds = isActive ? formatActiveActivitySeconds({ now, start }) : null;
    const thinkingOnly = isThinkingOnly(items);
    const defaultOpen = isActive || (!thinkingOnly && (hasNarration(items) || !showDurationHeader));
    const [open, setOpen] = React.useState(defaultOpen);
    const disclosureAnchor = useDisclosureScrollAnchor();

    React.useEffect(() => {
        if (isActive) {
            setOpen(true);
            return;
        }

        if (thinkingOnly) {
            setOpen(false);
        }
    }, [isActive, thinkingOnly]);

    const handleOpenChange = (nextOpen: boolean) => {
        setOpen(nextOpen);
        disclosureAnchor.preserve();
    };

    return (
        <ThinkingSteps className="w-full max-w-[34rem]" onOpenChange={handleOpenChange} open={open}>
            <ThinkingStepsHeader
                onKeyDown={disclosureAnchor.captureFromKeyboard}
                onPointerDown={disclosureAnchor.capture}
                ref={disclosureAnchor.triggerRef}
            >
                {showDurationHeader ? (
                    isActive && activeSeconds ? (
                        <span>
                            Working for{' '}
                            <span className="inline-block min-w-[2.2ch] text-left tabular-nums">
                                {activeSeconds}
                            </span>
                        </span>
                    ) : (
                        formatActivityHeader({ end, isActive, now, start })
                    )
                ) : (
                    formatWorkGroupHeader(items)
                )}
            </ThinkingStepsHeader>
            <ThinkingStepsContent className={showDurationHeader ? undefined : 'pt-1'}>
                {items.map((item, index) => (
                    <ActivityStep
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
        frameId: number | null;
        remainingFrames: number;
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
            frameId: null,
            remainingFrames: disclosureAnchorFrames,
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

            currentAnchor.remainingFrames -= 1;

            if (currentAnchor.remainingFrames <= 0) {
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

const disclosureAnchorFrames = 14;

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
    return (
        <Collapsible className="flex min-w-0 flex-col gap-3.5" defaultOpen>
            <CollapsibleTrigger className="group border-border/70 border-b pb-2 text-left font-medium text-[13px] text-muted-foreground leading-tight transition-colors hover:text-foreground">
                <span className="inline-flex items-center gap-1.5">
                    <TurnWorkHeaderContent end={end} start={start} status={status} />
                    <Icon
                        className="size-3.5 -rotate-90 transition-transform group-data-[panel-open]:rotate-0"
                        icon={ArrowDown01Icon}
                        strokeWidth={1.7}
                    />
                </span>
            </CollapsibleTrigger>
            <CollapsiblePanel>
                <div className="flex min-w-0 flex-col gap-4">{children}</div>
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
