import * as React from 'react';
import { useChatFollowScrollAnimation } from './chat-scroll-animation.ts';
import {
    type ChatScrollEvent,
    type ChatScrollMode,
    getAnchorScrollDelta,
    initialChatScrollMode,
    isNearBottom,
    transitionChatScrollMode,
} from './chat-scroll-mode.ts';

// Anchored mode normally exits when the disclosure panel's height transition
// finishes (transitionend bubbling to the viewport) plus one settle frame.
// The time fallback covers reduced motion, where no transition runs, and
// pointer-downs that never change the panel.
const anchorFallbackMs = 600;

// Stable per-chat handle for deep transcript components (disclosure triggers,
// the virtualizer) so they reach the controller without window events.
export interface ChatScrollControllerHandle {
    beginAnchor: (trigger: HTMLElement) => void;
    getMode: () => ChatScrollMode;
    restoreScrollPosition: (state: { isAtBottom: boolean }) => void;
    subscribeMode: (listener: () => void) => () => void;
}

const ChatScrollControllerContext = React.createContext<ChatScrollControllerHandle | null>(null);

export const ChatScrollControllerProvider = ChatScrollControllerContext.Provider;

export function useChatScrollControllerHandle() {
    return React.useContext(ChatScrollControllerContext);
}

const emptyChatScrollModeSubscribe = () => () => {};

function getInitialChatScrollModeSnapshot() {
    return initialChatScrollMode;
}

export function useChatScrollControllerMode() {
    const controller = useChatScrollControllerHandle();

    return React.useSyncExternalStore(
        controller?.subscribeMode ?? emptyChatScrollModeSubscribe,
        controller?.getMode ?? getInitialChatScrollModeSnapshot,
        getInitialChatScrollModeSnapshot
    );
}

interface ActiveAnchor {
    capturedTop: number;
    fallbackTimer: number;
    frameId: number | null;
    trigger: HTMLElement;
}

const userScrollIntentTtlMs = 300;

export function useChatScrollController({
    enabled,
    followKey,
    followContentResizes = true,
    initialScrollKey,
    pinPassiveScrollDrift = true,
}: {
    enabled: boolean;
    followKey?: string | null;
    followContentResizes?: boolean;
    initialScrollKey?: string | null;
    pinPassiveScrollDrift?: boolean;
}) {
    const viewportRef = React.useRef<HTMLDivElement | null>(null);
    const contentRef = React.useRef<HTMLDivElement | null>(null);
    const modeRef = React.useRef<ChatScrollMode>(initialChatScrollMode);
    const modeListenersRef = React.useRef(new Set<() => void>());
    const anchorRef = React.useRef<ActiveAnchor | null>(null);
    const userScrollIntentRef = React.useRef(false);
    const userScrollIntentTimerRef = React.useRef<number | null>(null);
    const [isAtBottom, setIsAtBottom] = React.useState(true);

    const notifyModeListeners = React.useCallback(() => {
        for (const listener of modeListenersRef.current) {
            listener();
        }
    }, []);

    const getMode = React.useCallback(() => modeRef.current, []);
    const followScrollAnimation = useChatFollowScrollAnimation({ getMode });

    const subscribeMode = React.useCallback((listener: () => void) => {
        const listeners = modeListenersRef.current;

        listeners.add(listener);

        return () => {
            listeners.delete(listener);
        };
    }, []);

    const dispatch = React.useCallback(
        (event: ChatScrollEvent) => {
            const previousMode = modeRef.current;
            const transition = transitionChatScrollMode(previousMode, event);
            modeRef.current = transition.mode;

            if (transition.mode !== previousMode) {
                notifyModeListeners();
            }

            return transition;
        },
        [notifyModeListeners]
    );

    const writeScrollToBottom = React.useCallback(
        (
            behavior: ScrollBehavior,
            options: {
                allowAnimation?: boolean;
            } = {}
        ) => {
            const viewport = viewportRef.current;

            if (!viewport) {
                return;
            }

            followScrollAnimation.scrollTo({
                allowAnimation: options.allowAnimation,
                behavior,
                element: viewport,
                target: viewport.scrollHeight,
            });
        },
        [followScrollAnimation]
    );

    const scrollToBottom = React.useCallback(
        (behavior: ScrollBehavior = 'smooth') => {
            dispatch({ type: 'followRequested' });
            writeScrollToBottom(behavior);
            setIsAtBottom(true);
        },
        [dispatch, writeScrollToBottom]
    );

    const clearAnchor = React.useCallback(() => {
        const anchor = anchorRef.current;

        if (!anchor) {
            return;
        }

        anchorRef.current = null;

        if (anchor.frameId !== null) {
            cancelAnimationFrame(anchor.frameId);
        }

        window.clearTimeout(anchor.fallbackTimer);
    }, []);

    const restoreScrollPosition = React.useCallback(
        ({ isAtBottom: restoredAtBottom }: { isAtBottom: boolean }) => {
            clearAnchor();

            dispatch(
                restoredAtBottom
                    ? { type: 'followRequested' }
                    : { isAtBottom: false, type: 'userScrolled' }
            );
            setIsAtBottom(restoredAtBottom);
        },
        [clearAnchor, dispatch]
    );

    const clearUserScrollIntent = React.useCallback(() => {
        userScrollIntentRef.current = false;

        if (userScrollIntentTimerRef.current !== null) {
            window.clearTimeout(userScrollIntentTimerRef.current);
            userScrollIntentTimerRef.current = null;
        }
    }, []);

    const markUserScrollIntent = React.useCallback(() => {
        clearUserScrollIntent();

        userScrollIntentRef.current = true;
        userScrollIntentTimerRef.current = window.setTimeout(() => {
            userScrollIntentRef.current = false;
            userScrollIntentTimerRef.current = null;
        }, userScrollIntentTtlMs);
    }, [clearUserScrollIntent]);

    const consumeUserScrollIntent = React.useCallback(() => {
        const userInitiated = userScrollIntentRef.current;
        clearUserScrollIntent();

        return userInitiated;
    }, [clearUserScrollIntent]);

    const endAnchor = React.useCallback(() => {
        if (!anchorRef.current) {
            return;
        }

        clearAnchor();

        const viewport = viewportRef.current;
        const atBottom = viewport ? isViewportNearBottom(viewport) : true;
        const transition = dispatch({ isAtBottom: atBottom, type: 'anchorEnded' });

        if (transition.mode !== 'anchored') {
            setIsAtBottom(atBottom);
        }
    }, [clearAnchor, dispatch]);

    const beginAnchor = React.useCallback(
        (trigger: HTMLElement) => {
            clearAnchor();
            dispatch({ type: 'anchorStarted' });

            const anchor: ActiveAnchor = {
                capturedTop: trigger.getBoundingClientRect().top,
                fallbackTimer: window.setTimeout(() => endAnchor(), anchorFallbackMs),
                frameId: null,
                trigger,
            };
            anchorRef.current = anchor;

            const pinFrame = () => {
                if (anchorRef.current !== anchor) {
                    return;
                }

                // User input moved the machine out of anchored — stop without
                // dispatching a stale anchor end.
                if (modeRef.current !== 'anchored') {
                    clearAnchor();
                    return;
                }

                const viewport = viewportRef.current;

                if (viewport) {
                    const delta = getAnchorScrollDelta({
                        capturedTop: anchor.capturedTop,
                        currentTop: anchor.trigger.getBoundingClientRect().top,
                    });

                    if (delta !== null) {
                        viewport.scrollTop += delta;
                    }
                }

                anchor.frameId = requestAnimationFrame(pinFrame);
            };

            anchor.frameId = requestAnimationFrame(pinFrame);
        },
        [clearAnchor, dispatch, endAnchor]
    );

    // The controller owns every viewport listener so no consumer can forget
    // one: scroll keeps the mode current, wheel/touch carry user intent, and
    // disclosure animation completion ends anchors when panel height settles.
    React.useEffect(() => {
        const viewport = viewportRef.current;

        if (!viewport) {
            return;
        }

        const handleScroll = () => {
            const atBottom = isViewportNearBottom(viewport);
            const transition = dispatch({
                isAtBottom: atBottom,
                type: 'scrolled',
                userInitiated: consumeUserScrollIntent(),
            });

            if (transition.mode !== 'anchored') {
                if (transition.action === 'pinBottom') {
                    if (pinPassiveScrollDrift) {
                        writeScrollToBottom('auto');
                    }
                    setIsAtBottom(true);
                } else {
                    setIsAtBottom(atBottom);
                }
            }
        };
        const handleUserScroll = () => {
            markUserScrollIntent();

            if (modeRef.current !== 'anchored') {
                return;
            }

            const atBottom = isViewportNearBottom(viewport);
            dispatch({ isAtBottom: atBottom, type: 'userScrolled' });
            setIsAtBottom(atBottom);
        };
        const handlePointerDown = (event: PointerEvent) => {
            if (isScrollbarPointerIntent(viewport, event)) {
                handleUserScroll();
            }
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (!isKeyboardScrollIntent(viewport, event)) {
                return;
            }

            handleUserScroll();
        };
        const handleTransitionEnd = (event: TransitionEvent) => {
            if (event.propertyName !== 'height') {
                return;
            }

            const anchor = anchorRef.current;

            if (!anchor) {
                return;
            }

            // One settle frame after the height transition so the panel's
            // final layout lands before ownership returns.
            requestAnimationFrame(() => {
                if (anchorRef.current === anchor) {
                    endAnchor();
                }
            });
        };
        const handleDisclosureAnimationEnd = () => {
            const anchor = anchorRef.current;

            if (!anchor) {
                return;
            }

            requestAnimationFrame(() => {
                if (anchorRef.current === anchor) {
                    endAnchor();
                }
            });
        };

        viewport.addEventListener('scroll', handleScroll, { passive: true });
        viewport.addEventListener('wheel', handleUserScroll, { passive: true });
        viewport.addEventListener('pointerdown', handlePointerDown);
        viewport.addEventListener('touchmove', handleUserScroll, { passive: true });
        viewport.addEventListener('transitionend', handleTransitionEnd);
        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('chat-disclosure-animation-end', handleDisclosureAnimationEnd);

        return () => {
            viewport.removeEventListener('scroll', handleScroll);
            viewport.removeEventListener('wheel', handleUserScroll);
            viewport.removeEventListener('pointerdown', handlePointerDown);
            viewport.removeEventListener('touchmove', handleUserScroll);
            viewport.removeEventListener('transitionend', handleTransitionEnd);
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener(
                'chat-disclosure-animation-end',
                handleDisclosureAnimationEnd
            );
            clearUserScrollIntent();
        };
    }, [
        clearUserScrollIntent,
        consumeUserScrollIntent,
        dispatch,
        endAnchor,
        markUserScrollIntent,
        pinPassiveScrollDrift,
        writeScrollToBottom,
    ]);

    // Bottom-follow for non-virtualized surfaces: content growth or shrink
    // while following re-pins the bottom. Virtualized transcripts let TanStack
    // own measured-row follow reconciliation.
    React.useEffect(() => {
        if (!(enabled && followContentResizes) || typeof ResizeObserver === 'undefined') {
            return;
        }

        const content = contentRef.current;

        if (!content) {
            return;
        }

        const observer = new ResizeObserver(() => {
            const transition = dispatch({ type: 'contentResized' });

            if (transition.action === 'pinBottom') {
                writeScrollToBottom('auto');
            }
        });

        observer.observe(content);

        return () => observer.disconnect();
    }, [dispatch, enabled, followContentResizes, writeScrollToBottom]);

    React.useLayoutEffect(() => {
        if (enabled && modeRef.current === 'following') {
            writeScrollToBottom('auto', { allowAnimation: false });
        }
    }, [enabled, writeScrollToBottom]);

    React.useLayoutEffect(() => {
        if (enabled && followKey) {
            scrollToBottom('auto');
        }
    }, [enabled, followKey, scrollToBottom]);

    React.useLayoutEffect(() => {
        if (enabled && initialScrollKey) {
            dispatch({ type: 'followRequested' });
            writeScrollToBottom('auto', { allowAnimation: false });
            setIsAtBottom(true);
        }
    }, [dispatch, enabled, initialScrollKey, writeScrollToBottom]);

    React.useEffect(() => clearAnchor, [clearAnchor]);
    React.useEffect(() => clearUserScrollIntent, [clearUserScrollIntent]);

    const handle = React.useMemo<ChatScrollControllerHandle>(
        () => ({
            beginAnchor,
            getMode,
            restoreScrollPosition,
            subscribeMode,
        }),
        [beginAnchor, getMode, restoreScrollPosition, subscribeMode]
    );

    return {
        contentRef,
        handle,
        isAtBottom,
        scrollToBottom,
        viewportRef,
    };
}

function isViewportNearBottom(viewport: HTMLElement) {
    return isNearBottom({
        clientHeight: viewport.clientHeight,
        scrollHeight: viewport.scrollHeight,
        scrollTop: viewport.scrollTop,
    });
}

function isScrollbarPointerIntent(viewport: HTMLElement, event: PointerEvent) {
    if (event.target !== viewport) {
        return false;
    }

    const bounds = viewport.getBoundingClientRect();
    const verticalScrollbarWidth = viewport.offsetWidth - viewport.clientWidth;
    const horizontalScrollbarHeight = viewport.offsetHeight - viewport.clientHeight;
    const verticalHitWidth = Math.max(verticalScrollbarWidth, 16);
    const horizontalHitHeight = Math.max(horizontalScrollbarHeight, 16);

    return (
        event.clientX >= bounds.right - verticalHitWidth ||
        event.clientY >= bounds.bottom - horizontalHitHeight
    );
}

function isKeyboardScrollIntent(viewport: HTMLElement, event: KeyboardEvent) {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) {
        return false;
    }

    if (!keyboardScrollKeys.has(event.key)) {
        return false;
    }

    const activeElement = document.activeElement;

    return activeElement === viewport || (activeElement ? viewport.contains(activeElement) : false);
}

const keyboardScrollKeys = new Set([
    ' ',
    'ArrowDown',
    'ArrowUp',
    'End',
    'Home',
    'PageDown',
    'PageUp',
]);
