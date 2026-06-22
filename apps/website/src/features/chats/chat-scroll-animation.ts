import * as React from 'react';
import type { ChatScrollMode } from './chat-scroll-mode.ts';

const chatFollowScrollAnimationMinDistancePx = 32;
const chatFollowScrollAnimationMaxDistancePx = 1600;
const chatFollowScrollAnimationMinDurationMs = 180;
const chatFollowScrollAnimationMaxDurationMs = 420;
const chatFollowScrollAnimationMaxFrameStepPx = 128;
const chatFollowScrollTargetTolerancePx = 0.5;

export type ChatScrollAxis = 'left' | 'top';

const noInitialScrollPending = () => false;

interface ChatScrollDebugEntry {
    allowAnimation: boolean;
    animated: boolean;
    axis: ChatScrollAxis;
    behavior: ScrollBehavior;
    current: number;
    distancePx: number;
    isInitialScrollPending: boolean;
    mode: ChatScrollMode;
    reduceMotion: boolean;
    target: number;
    timestamp: number;
}

declare global {
    interface Window {
        __TAVERN_SCROLL_DEBUG__?: ChatScrollDebugEntry[];
    }
}

interface ActiveChatScrollAnimation {
    axis: ChatScrollAxis;
    cancelFrame: (frameId: number) => void;
    durationMs: number;
    element: HTMLElement;
    frameId: number | null;
    start: number;
    startedAt: number | null;
    target: number;
}

export function useChatFollowScrollAnimation({
    getMode,
    isInitialScrollPending = noInitialScrollPending,
}: {
    getMode: () => ChatScrollMode;
    isInitialScrollPending?: () => boolean;
}) {
    const animationRef = React.useRef<ActiveChatScrollAnimation | null>(null);

    const cancel = React.useCallback(() => {
        const animation = animationRef.current;

        if (!animation) {
            return;
        }

        animationRef.current = null;

        if (animation.frameId !== null) {
            animation.cancelFrame(animation.frameId);
        }
    }, []);

    const scrollTo = React.useCallback(
        ({
            allowAnimation = true,
            axis = 'top',
            behavior = 'auto',
            element,
            target,
        }: {
            allowAnimation?: boolean;
            axis?: ChatScrollAxis;
            behavior?: ScrollBehavior;
            element: HTMLElement;
            target: number;
        }) => {
            const resolvedTarget = clampElementScrollTarget(element, axis, target);
            const current = getElementScrollOffset(element, axis);
            const distancePx = resolvedTarget - current;
            const isInitialPending = isInitialScrollPending();
            const mode = getMode();
            const reduceMotion = prefersReducedScrollMotion(element);
            const shouldAnimate =
                allowAnimation &&
                shouldAnimateChatFollowScrollWrite({
                    distancePx,
                    isInitialScrollPending: isInitialPending,
                    mode,
                    reduceMotion,
                    requestedBehavior: behavior,
                });

            recordChatScrollDebug(element, {
                allowAnimation,
                animated: shouldAnimate,
                axis,
                behavior,
                current,
                distancePx,
                isInitialScrollPending: isInitialPending,
                mode,
                reduceMotion,
                target: resolvedTarget,
            });

            if (shouldAnimate) {
                animateChatFollowScroll({
                    axis,
                    cancel,
                    element,
                    getMode,
                    target: resolvedTarget,
                    animationRef,
                });
                return;
            }

            cancel();
            writeElementScrollOffset(element, axis, resolvedTarget, behavior);
        },
        [cancel, getMode, isInitialScrollPending]
    );

    React.useEffect(() => cancel, [cancel]);

    return React.useMemo(() => ({ cancel, scrollTo }), [cancel, scrollTo]);
}

export function shouldAnimateChatFollowScrollWrite({
    distancePx,
    isInitialScrollPending,
    mode,
    reduceMotion,
    requestedBehavior,
}: {
    distancePx: number;
    isInitialScrollPending: boolean;
    mode: ChatScrollMode;
    reduceMotion: boolean;
    requestedBehavior?: ScrollBehavior;
}) {
    if (
        mode !== 'following' ||
        isInitialScrollPending ||
        reduceMotion ||
        (requestedBehavior ?? 'auto') !== 'auto'
    ) {
        return false;
    }

    const distance = Math.abs(distancePx);

    return (
        distance >= chatFollowScrollAnimationMinDistancePx &&
        distance <= chatFollowScrollAnimationMaxDistancePx
    );
}

export function getChatFollowScrollAnimationDurationMs(distancePx: number) {
    return Math.min(
        Math.max(Math.abs(distancePx) * 0.45, chatFollowScrollAnimationMinDurationMs),
        chatFollowScrollAnimationMaxDurationMs
    );
}

export function getChatFollowScrollFrameOffset({
    current,
    desired,
}: {
    current: number;
    desired: number;
}) {
    const delta = desired - current;

    if (Math.abs(delta) <= chatFollowScrollAnimationMaxFrameStepPx) {
        return desired;
    }

    return current + Math.sign(delta) * chatFollowScrollAnimationMaxFrameStepPx;
}

function animateChatFollowScroll({
    animationRef,
    axis,
    cancel,
    element,
    getMode,
    target,
}: {
    animationRef: React.MutableRefObject<ActiveChatScrollAnimation | null>;
    axis: ChatScrollAxis;
    cancel: () => void;
    element: HTMLElement;
    getMode: () => ChatScrollMode;
    target: number;
}) {
    const active = animationRef.current;

    if (
        active &&
        active.axis === axis &&
        active.element === element &&
        Math.abs(active.target - target) <= chatFollowScrollTargetTolerancePx
    ) {
        return;
    }

    cancel();

    const view = element.ownerDocument.defaultView ?? window;
    const requestFrame = view.requestAnimationFrame.bind(view);
    const cancelFrame = view.cancelAnimationFrame.bind(view);
    const start = getElementScrollOffset(element, axis);
    const distance = target - start;
    const durationMs = getChatFollowScrollAnimationDurationMs(distance);
    const animation: ActiveChatScrollAnimation = {
        axis,
        cancelFrame,
        durationMs,
        element,
        frameId: null,
        start,
        startedAt: null,
        target,
    };

    const step = (timestamp: number) => {
        if (animationRef.current !== animation) {
            return;
        }

        if (getMode() !== 'following') {
            animationRef.current = null;
            return;
        }

        if (animation.startedAt === null) {
            animation.startedAt = timestamp;
            animation.start = getElementScrollOffset(element, axis);
            animation.durationMs = getChatFollowScrollAnimationDurationMs(target - animation.start);
        }

        const progress = Math.min(
            Math.max((timestamp - animation.startedAt) / animation.durationMs, 0),
            1
        );
        const desiredOffset = animation.start + (target - animation.start) * easeOutCubic(progress);
        const offset = getChatFollowScrollFrameOffset({
            current: getElementScrollOffset(element, axis),
            desired: desiredOffset,
        });

        writeElementScrollOffset(element, axis, offset, 'auto');

        if (progress < 1 || Math.abs(target - offset) > chatFollowScrollTargetTolerancePx) {
            animation.frameId = requestFrame(step);
            return;
        }

        writeElementScrollOffset(element, axis, target, 'auto');
        animationRef.current = null;
    };

    animationRef.current = animation;
    animation.frameId = requestFrame(step);
}

function recordChatScrollDebug(
    element: HTMLElement,
    entry: Omit<ChatScrollDebugEntry, 'timestamp'>
) {
    const debug = element.ownerDocument.defaultView?.__TAVERN_SCROLL_DEBUG__;

    if (!debug) {
        return;
    }

    debug.push({
        ...entry,
        timestamp: element.ownerDocument.defaultView?.performance.now() ?? Date.now(),
    });
}

function easeOutCubic(progress: number) {
    return 1 - (1 - progress) ** 3;
}

function clampElementScrollTarget(element: HTMLElement, axis: ChatScrollAxis, target: number) {
    const max =
        axis === 'left'
            ? Math.max(element.scrollWidth - element.clientWidth, 0)
            : Math.max(element.scrollHeight - element.clientHeight, 0);

    return Math.min(Math.max(target, 0), max);
}

function getElementScrollOffset(element: HTMLElement, axis: ChatScrollAxis) {
    return axis === 'left' ? element.scrollLeft : element.scrollTop;
}

function writeElementScrollOffset(
    element: HTMLElement,
    axis: ChatScrollAxis,
    offset: number,
    behavior: ScrollBehavior
) {
    if (axis === 'left') {
        element.scrollTo({ behavior, left: offset });
        return;
    }

    element.scrollTo({ behavior, top: offset });
}

function prefersReducedScrollMotion(element: HTMLElement) {
    const view = element.ownerDocument.defaultView;

    return Boolean(view?.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}
