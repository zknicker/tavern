import * as React from 'react';

const bottomTolerance = 72;

function isNearBottom(container: HTMLElement) {
    return container.scrollHeight - container.scrollTop - container.clientHeight <= bottomTolerance;
}

export function useChatScroll({
    enabled,
    followResizes = true,
    followKey,
    initialScrollKey,
}: {
    enabled: boolean;
    followResizes?: boolean;
    followKey?: string | null;
    initialScrollKey?: string | null;
}) {
    const viewportRef = React.useRef<HTMLDivElement | null>(null);
    const contentRef = React.useRef<HTMLDivElement | null>(null);
    const shouldFollowRef = React.useRef(true);
    const [isAtBottom, setIsAtBottom] = React.useState(true);

    const scrollToBottom = React.useCallback((behavior: ScrollBehavior = 'smooth') => {
        const viewport = viewportRef.current;

        if (!viewport) {
            return;
        }

        viewport.scrollTo({
            behavior,
            top: viewport.scrollHeight,
        });
        shouldFollowRef.current = true;
        setIsAtBottom(true);
    }, []);

    const handleScroll = React.useCallback(() => {
        const viewport = viewportRef.current;

        if (!viewport) {
            return;
        }

        const nextIsAtBottom = isNearBottom(viewport);
        shouldFollowRef.current = nextIsAtBottom;
        setIsAtBottom(nextIsAtBottom);
    }, []);

    React.useLayoutEffect(() => {
        if (!(enabled && shouldFollowRef.current)) {
            return;
        }

        scrollToBottom('auto');
    }, [enabled, scrollToBottom]);

    React.useLayoutEffect(() => {
        if (!(enabled && followKey)) {
            return;
        }

        scrollToBottom('auto');
    }, [enabled, followKey, scrollToBottom]);

    React.useLayoutEffect(() => {
        if (!(enabled && initialScrollKey)) {
            return;
        }

        shouldFollowRef.current = true;
        scrollToBottom('auto');
    }, [enabled, initialScrollKey, scrollToBottom]);

    React.useEffect(() => {
        if (!(enabled && followResizes) || typeof ResizeObserver === 'undefined') {
            return;
        }

        const content = contentRef.current;

        if (!content) {
            return;
        }

        const observer = new ResizeObserver(() => {
            if (shouldFollowRef.current) {
                scrollToBottom('auto');
            }
        });

        observer.observe(content);

        return () => observer.disconnect();
    }, [enabled, followResizes, scrollToBottom]);

    return {
        contentRef,
        handleScroll,
        isAtBottom,
        scrollToBottom,
        viewportRef,
    };
}
