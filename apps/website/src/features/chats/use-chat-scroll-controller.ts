import * as React from 'react';
import {
    type ChatScrollEvent,
    type ChatScrollMode,
    getAnchorScrollDelta,
    initialChatScrollMode,
    isNearBottom,
    shouldVirtualizerAdjustForItem,
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
    pinBottomIfFollowing: () => void;
    shouldVirtualizerAdjust: (itemStart: number) => boolean;
}

const ChatScrollControllerContext = React.createContext<ChatScrollControllerHandle | null>(null);

export const ChatScrollControllerProvider = ChatScrollControllerContext.Provider;

export function useChatScrollControllerHandle() {
    return React.useContext(ChatScrollControllerContext);
}

interface ActiveAnchor {
    capturedTop: number;
    fallbackTimer: number;
    frameId: number | null;
    trigger: HTMLElement;
}

export function useChatScrollController({
    enabled,
    followKey,
    initialScrollKey,
}: {
    enabled: boolean;
    followKey?: string | null;
    initialScrollKey?: string | null;
}) {
    const viewportRef = React.useRef<HTMLDivElement | null>(null);
    const contentRef = React.useRef<HTMLDivElement | null>(null);
    const modeRef = React.useRef<ChatScrollMode>(initialChatScrollMode);
    const anchorRef = React.useRef<ActiveAnchor | null>(null);
    const [isAtBottom, setIsAtBottom] = React.useState(true);

    const dispatch = React.useCallback((event: ChatScrollEvent) => {
        const transition = transitionChatScrollMode(modeRef.current, event);
        modeRef.current = transition.mode;

        return transition;
    }, []);

    const writeScrollToBottom = React.useCallback((behavior: ScrollBehavior) => {
        const viewport = viewportRef.current;

        if (!viewport) {
            return;
        }

        viewport.scrollTo({ behavior, top: viewport.scrollHeight });
    }, []);

    const scrollToBottom = React.useCallback(
        (behavior: ScrollBehavior = 'smooth') => {
            dispatch({ type: 'followRequested' });
            writeScrollToBottom(behavior);
            setIsAtBottom(true);
        },
        [dispatch, writeScrollToBottom]
    );

    const pinBottomIfFollowing = React.useCallback(() => {
        const transition = dispatch({ type: 'contentResized' });

        if (transition.action !== 'pinBottom') {
            return;
        }

        writeScrollToBottom('auto');
        setIsAtBottom(true);
    }, [dispatch, writeScrollToBottom]);

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
            const transition = dispatch({ isAtBottom: atBottom, type: 'scrolled' });

            if (transition.mode !== 'anchored') {
                setIsAtBottom(atBottom);
            }
        };
        const handleUserScroll = () => {
            const atBottom = isViewportNearBottom(viewport);
            dispatch({ isAtBottom: atBottom, type: 'userScrolled' });
            setIsAtBottom(atBottom);
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
        viewport.addEventListener('touchmove', handleUserScroll, { passive: true });
        viewport.addEventListener('transitionend', handleTransitionEnd);
        document.addEventListener('chat-disclosure-animation-end', handleDisclosureAnimationEnd);

        return () => {
            viewport.removeEventListener('scroll', handleScroll);
            viewport.removeEventListener('wheel', handleUserScroll);
            viewport.removeEventListener('touchmove', handleUserScroll);
            viewport.removeEventListener('transitionend', handleTransitionEnd);
            document.removeEventListener(
                'chat-disclosure-animation-end',
                handleDisclosureAnimationEnd
            );
        };
    }, [dispatch, endAnchor]);

    // Bottom-follow: any content growth or shrink while following re-pins the
    // bottom. This also settles the initial virtualized render — estimated
    // sizes correct themselves through resizes until the true bottom holds.
    React.useEffect(() => {
        if (!enabled || typeof ResizeObserver === 'undefined') {
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
    }, [dispatch, enabled, writeScrollToBottom]);

    React.useLayoutEffect(() => {
        if (enabled && modeRef.current === 'following') {
            writeScrollToBottom('auto');
        }
    }, [enabled, writeScrollToBottom]);

    React.useLayoutEffect(() => {
        if (enabled && followKey) {
            scrollToBottom('auto');
        }
    }, [enabled, followKey, scrollToBottom]);

    React.useLayoutEffect(() => {
        if (enabled && initialScrollKey) {
            scrollToBottom('auto');
        }
    }, [enabled, initialScrollKey, scrollToBottom]);

    React.useEffect(() => clearAnchor, [clearAnchor]);

    const handle = React.useMemo<ChatScrollControllerHandle>(
        () => ({
            beginAnchor,
            pinBottomIfFollowing,
            shouldVirtualizerAdjust: (itemStart: number) => {
                const viewport = viewportRef.current;

                if (!viewport) {
                    return false;
                }

                return shouldVirtualizerAdjustForItem({
                    itemStart,
                    mode: modeRef.current,
                    scrollTop: viewport.scrollTop,
                });
            },
        }),
        [beginAnchor, pinBottomIfFollowing]
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
