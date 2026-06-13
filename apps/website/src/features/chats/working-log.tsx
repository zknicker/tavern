import { ArrowDown01Icon } from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { Icon } from '../../components/ui/icon.tsx';
import { cn } from '../../lib/utils.ts';
import { hasErrorStatus } from '../sessions/tools/tool-ui.ts';
import { ActivityStep } from './chat-transcript-activity-step.tsx';
import {
    type ActivityItem,
    formatActiveActivitySeconds,
    formatActivityHeader,
    formatWorkGroupHeader,
    getActiveWorkLabel,
    getActivityItemKey,
    getWorkGroupIcon,
} from './chat-transcript-activity-utils.ts';
import { ThinkingSteps, ThinkingStepsContent, ThinkingStepsHeader } from './thinking-steps.tsx';
import { ToolRowHoverRoot, useToolRowHoverGroup } from './tool-row-hover.ts';
import { useChatScrollControllerHandle } from './use-chat-scroll-controller.ts';

export function WorkingLog({
    animateEnter = false,
    chatId,
    currentSessionKey,
    end,
    items,
    showDurationHeader = true,
    start,
    status,
}: {
    animateEnter?: boolean;
    chatId?: string;
    currentSessionKey?: string | null;
    end: string | null;
    items: ActivityItem[];
    showDurationHeader?: boolean;
    start: string | null;
    status: 'active' | 'completed';
}) {
    const isActive = status === 'active';
    // Group mode (no duration header) renders Codex-style: a collapsed
    // drawer that exists from the first step. The header carries the active
    // tool's synopsis while work executes and the count summary at rest;
    // only the text changes, never the structure.
    const groupMode = !showDurationHeader;
    const now = useNow(isActive && start !== null, start);
    const activeSeconds = isActive ? formatActiveActivitySeconds({ now, start }) : null;
    const thinkingOnly = isThinkingOnly(items);
    const firstPendingApprovalId = findFirstPendingApprovalId(items);
    const firstPendingClarificationId = findFirstPendingClarificationId(items);
    const hasPendingPrompt = Boolean(firstPendingApprovalId ?? firstPendingClarificationId);
    const defaultOpen = groupMode
        ? hasPendingPrompt
        : isActive || (!thinkingOnly && hasNarration(items));
    const [open, setOpen] = React.useState(defaultOpen);
    const disclosureAnchor = useDisclosureScrollAnchor();

    React.useEffect(() => {
        if (groupMode) {
            if (hasPendingPrompt) {
                setOpen(true);
            }
            return;
        }

        if (isActive) {
            setOpen(true);
            return;
        }

        if (thinkingOnly) {
            setOpen(false);
        }
    }, [groupMode, hasPendingPrompt, isActive, thinkingOnly]);

    const groupLabel = groupMode
        ? isActive
            ? (getActiveWorkLabel(items) ?? formatWorkGroupHeader(items))
            : formatWorkGroupHeader(items)
        : null;
    const groupIcon = groupMode ? getWorkGroupIcon(items) : null;
    const rowHover = useToolRowHoverGroup({
        enabled: groupMode,
        headerRef: disclosureAnchor.triggerRef,
        measureKey: groupMode ? `${open}:${items.length}:${groupLabel ?? ''}` : '',
    });

    return (
        <ToolRowHoverRoot value={rowHover.contextValue}>
            <ThinkingSteps
                // Group mode: the trigger's click padding must not stack onto the
                // surrounding 16px block rhythm.
                className={cn(
                    'w-full max-w-[34rem]',
                    groupMode && 'relative -my-1.5',
                    groupMode && animateEnter && 'chat-step-enter'
                )}
                onOpenChange={setOpen}
                open={open}
                ref={groupMode ? rowHover.containerRef : undefined}
            >
                {rowHover.hoverLayer}
                <ThinkingStepsHeader
                    className={
                        groupMode
                            ? 'relative z-10 w-full py-1.5 pr-2 pl-3 font-normal text-muted-foreground/85 outline-none transition-none hover:bg-surface-1 hover:text-muted-foreground/85 focus-visible:bg-surface-1 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset'
                            : undefined
                    }
                    onFocus={groupMode ? rowHover.clearActiveItem : undefined}
                    onKeyDown={disclosureAnchor.captureFromKeyboard}
                    onMouseEnter={groupMode ? rowHover.clearActiveItem : undefined}
                    onPointerDown={disclosureAnchor.capture}
                    ref={groupMode ? rowHover.registerHeader : disclosureAnchor.triggerRef}
                    wrapperClassName={groupMode ? 'relative z-10 w-full' : undefined}
                >
                    {groupMode ? (
                        <span className="flex min-w-0 items-center gap-2">
                            {groupIcon ? (
                                <span className="-ml-1 flex size-4 shrink-0 items-center justify-center">
                                    <Icon
                                        className="size-4 text-muted-foreground/75"
                                        icon={groupIcon}
                                        strokeWidth={1.5}
                                    />
                                </span>
                            ) : null}
                            <span
                                className={cn(
                                    'min-w-0 max-w-[28rem] truncate text-left',
                                    isActive && 'thinking-indicator-text'
                                )}
                            >
                                {groupLabel}
                            </span>
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
                <ThinkingStepsContent
                    className={showDurationHeader ? undefined : 'relative z-10 pt-1'}
                >
                    {items.map((item, index) => (
                        <ActivityStep
                            animateEnter={isActive}
                            canRespondToApproval={item.row.id === firstPendingApprovalId}
                            canRespondToClarification={item.row.id === firstPendingClarificationId}
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
        </ToolRowHoverRoot>
    );
}

function findFirstPendingApprovalId(items: ActivityItem[]) {
    const item = items.find(
        (candidate) =>
            candidate.row.kind === 'tool' &&
            candidate.row.toolCall.name.trim().toLowerCase() === 'approval' &&
            !candidate.row.completedAt &&
            !hasErrorStatus(candidate.row.toolCall.status)
    );

    return item?.row.id ?? null;
}

function findFirstPendingClarificationId(items: ActivityItem[]) {
    const item = items.find(
        (candidate) =>
            candidate.row.kind === 'tool' &&
            candidate.row.toolCall.name.trim().toLowerCase() === 'clarify' &&
            !candidate.row.completedAt &&
            !hasErrorStatus(candidate.row.toolCall.status)
    );

    return item?.row.id ?? null;
}

// Manual disclosure toggles anchor the trigger's viewport position through
// the chat scroll controller, which owns scrollTop and releases the anchor
// when the panel's height transition settles. No-op outside a chat scroll
// area (session log, layout previews).
function useDisclosureScrollAnchor() {
    const controller = useChatScrollControllerHandle();
    const triggerRef = React.useRef<HTMLButtonElement | null>(null);

    const capture = React.useCallback(() => {
        const trigger = triggerRef.current;

        if (trigger) {
            controller?.beginAnchor(trigger);
        }
    }, [controller]);

    const captureFromKeyboard = React.useCallback(
        (event: React.KeyboardEvent<HTMLButtonElement>) => {
            if (event.key === 'Enter' || event.key === ' ') {
                capture();
            }
        },
        [capture]
    );

    return { capture, captureFromKeyboard, triggerRef };
}

export function TurnWorkDisclosure({
    children,
    collapseForReply = false,
    end,
    start,
    status,
}: {
    children: React.ReactNode;
    collapseForReply?: boolean;
    end: string | null;
    start: string | null;
    status: 'active' | 'completed';
}) {
    const isActive = status === 'active';
    // Open while the turn works; collapse as soon as the final reply begins
    // streaming. Completed turns start collapsed so history reads the same
    // way a finished live turn does. Users can re-open at any time.
    const [open, setOpenState] = React.useState(isActive);
    const [panelHeight, setPanelHeight] = React.useState(0);
    const panelId = React.useId();
    const panelContentRef = React.useRef<HTMLDivElement | null>(null);
    const openRef = React.useRef(open);
    const frameRef = React.useRef<number | null>(null);
    const transitionTimerRef = React.useRef<number | null>(null);
    const transitioningRef = React.useRef(false);
    const wasActiveRef = React.useRef(isActive);
    const [transitioning, setTransitioning] = React.useState(false);
    // Manual toggles anchor the trigger so the panel expands downward even
    // when the chat is bottomed out; the completion auto-collapse stays
    // unanchored so bottom-follow keeps the reply pinned instead.
    const disclosureAnchor = useDisclosureScrollAnchor();
    const scheduleHeightTransition = React.useCallback((nextHeight: number) => {
        frameRef.current = requestAnimationFrame(() => {
            frameRef.current = requestAnimationFrame(() => {
                frameRef.current = null;
                setPanelHeight(nextHeight);
            });
        });
    }, []);
    const finishPanelTransition = React.useCallback(() => {
        transitioningRef.current = false;
        setTransitioning(false);

        if (transitionTimerRef.current !== null) {
            window.clearTimeout(transitionTimerRef.current);
            transitionTimerRef.current = null;
        }
    }, []);
    const startPanelTransition = React.useCallback(() => {
        transitioningRef.current = true;
        setTransitioning(true);

        if (transitionTimerRef.current !== null) {
            window.clearTimeout(transitionTimerRef.current);
        }

        transitionTimerRef.current = window.setTimeout(finishPanelTransition, 380);
    }, [finishPanelTransition]);
    const setOpen = React.useCallback(
        (nextOpen: boolean) => {
            if (frameRef.current !== null) {
                cancelAnimationFrame(frameRef.current);
                frameRef.current = null;
            }

            const content = panelContentRef.current;
            const measuredHeight = content?.scrollHeight ?? 0;
            openRef.current = nextOpen;
            startPanelTransition();

            if (nextOpen) {
                setOpenState(true);
                setPanelHeight(0);
                scheduleHeightTransition(panelContentRef.current?.scrollHeight ?? measuredHeight);
                return;
            }

            setOpenState(false);
            setPanelHeight(measuredHeight);
            scheduleHeightTransition(0);
        },
        [scheduleHeightTransition, startPanelTransition]
    );

    React.useEffect(() => {
        if (collapseForReply) {
            wasActiveRef.current = true;
            setOpen(false);
            return;
        }

        if (isActive) {
            wasActiveRef.current = true;
            setOpen(true);
            return;
        }

        if (!wasActiveRef.current) {
            return;
        }

        wasActiveRef.current = false;
        setOpen(false);
    }, [collapseForReply, isActive, setOpen]);

    React.useEffect(
        () => () => {
            if (frameRef.current !== null) {
                cancelAnimationFrame(frameRef.current);
            }

            if (transitionTimerRef.current !== null) {
                window.clearTimeout(transitionTimerRef.current);
            }
        },
        []
    );

    React.useLayoutEffect(() => {
        const content = panelContentRef.current;

        if (!(content && openRef.current)) {
            return;
        }

        setPanelHeight(content.scrollHeight);
    }, []);

    React.useEffect(() => {
        const content = panelContentRef.current;

        if (!content || typeof ResizeObserver === 'undefined') {
            return;
        }

        const observer = new ResizeObserver(() => {
            if (openRef.current) {
                setPanelHeight(content.scrollHeight);
            }
        });

        observer.observe(content);

        return () => observer.disconnect();
    }, []);

    const panelStyle = React.useMemo<React.CSSProperties>(
        () => ({
            height: `${panelHeight}px`,
            transition: transitioning ? undefined : 'none',
        }),
        [panelHeight, transitioning]
    );

    const handlePanelTransitionEnd = React.useCallback(
        (event: React.TransitionEvent<HTMLDivElement>) => {
            if (event.target !== event.currentTarget || event.propertyName !== 'height') {
                return;
            }

            finishPanelTransition();
        },
        [finishPanelTransition]
    );

    return (
        <div className="flex min-w-0 flex-col">
            <button
                aria-controls={panelId}
                aria-expanded={open}
                className="group rounded-md border-border/70 border-b pb-2 text-left font-medium text-[13px] text-muted-foreground leading-tight transition-colors hover:text-foreground"
                data-panel-open={open ? '' : undefined}
                onClick={() => setOpen(!open)}
                onKeyDown={disclosureAnchor.captureFromKeyboard}
                onPointerDown={disclosureAnchor.capture}
                ref={disclosureAnchor.triggerRef}
                type="button"
            >
                <span className="inline-flex items-center gap-1.5">
                    <TurnWorkHeaderContent end={end} start={start} status={status} />
                    <Icon
                        className="size-3.5 -rotate-90 transition-transform group-data-[panel-open]:rotate-0"
                        icon={ArrowDown01Icon}
                        strokeWidth={1.7}
                    />
                </span>
            </button>
            <div
                aria-hidden={!open}
                className="chat-turn-work-panel"
                id={panelId}
                inert={open ? undefined : true}
                onTransitionEnd={handlePanelTransitionEnd}
                style={panelStyle}
            >
                {/* Spacing lives inside the animated panel so it collapses with
                    the height instead of vanishing in one frame at the end. */}
                <div className="flex min-w-0 flex-col gap-4 pt-3.5" ref={panelContentRef}>
                    {children}
                </div>
            </div>
        </div>
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
