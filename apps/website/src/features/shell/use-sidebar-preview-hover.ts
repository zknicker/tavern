import * as React from 'react';

const sidebarHoverTargetWidth = 8;
const sidebarPreviewCloseDelayMs = 120;

interface SidebarPointerPoint {
    clientX: number;
    clientY: number;
}

interface UseSidebarPreviewHoverOptions {
    enabled: boolean;
    isPinnedOpen: boolean;
    sidebarWrapperRef: React.RefObject<HTMLDivElement | null>;
}

export function useSidebarPreviewHover({
    enabled,
    isPinnedOpen,
    sidebarWrapperRef,
}: UseSidebarPreviewHoverOptions) {
    const [isPreviewOpen, setIsPreviewOpen] = React.useState(false);
    const closeTimeoutRef = React.useRef<number | null>(null);
    const pointerRef = React.useRef<SidebarPointerPoint | null>(null);

    const clearCloseTimeout = React.useCallback(() => {
        if (closeTimeoutRef.current !== null) {
            window.clearTimeout(closeTimeoutRef.current);
            closeTimeoutRef.current = null;
        }
    }, []);

    const updatePointer = React.useCallback((point: SidebarPointerPoint) => {
        pointerRef.current = {
            clientX: point.clientX,
            clientY: point.clientY,
        };
    }, []);

    const isPointerInsidePreview = React.useCallback(
        (point = pointerRef.current) => {
            if (!point) {
                return false;
            }

            const sidebarWidth = getSidebarPreviewWidth(sidebarWrapperRef.current);

            return (
                sidebarWidth > 0 &&
                point.clientX >= 0 &&
                point.clientX <= sidebarWidth &&
                point.clientY >= 0 &&
                point.clientY <= window.innerHeight
            );
        },
        [sidebarWrapperRef]
    );

    const openPreview = React.useCallback(
        (point?: SidebarPointerPoint) => {
            if (point) {
                updatePointer(point);
            }

            clearCloseTimeout();
            setIsPreviewOpen(true);
        },
        [clearCloseTimeout, updatePointer]
    );

    const closePreview = React.useCallback(() => {
        clearCloseTimeout();
        pointerRef.current = null;
        setIsPreviewOpen(false);
    }, [clearCloseTimeout]);

    const schedulePreviewClose = React.useCallback(
        (point?: SidebarPointerPoint) => {
            if (point) {
                updatePointer(point);
            }

            clearCloseTimeout();
            closeTimeoutRef.current = window.setTimeout(() => {
                closeTimeoutRef.current = null;

                if (isPointerInsidePreview()) {
                    return;
                }

                pointerRef.current = null;
                setIsPreviewOpen(false);
            }, sidebarPreviewCloseDelayMs);
        },
        [clearCloseTimeout, isPointerInsidePreview, updatePointer]
    );

    React.useEffect(
        () => () => {
            clearCloseTimeout();
        },
        [clearCloseTimeout]
    );

    React.useEffect(() => {
        if (!enabled || isPinnedOpen) {
            closePreview();
        }
    }, [closePreview, enabled, isPinnedOpen]);

    React.useEffect(() => {
        if (!enabled || isPinnedOpen) {
            return;
        }

        const handlePointerMove = (event: PointerEvent) => {
            if (event.pointerType === 'touch') {
                return;
            }

            updatePointer(event);

            if (isPreviewOpen) {
                if (isPointerInsidePreview(event)) {
                    clearCloseTimeout();
                    return;
                }

                schedulePreviewClose(event);
                return;
            }

            if (event.clientX <= sidebarHoverTargetWidth) {
                openPreview(event);
            }
        };

        window.addEventListener('pointermove', handlePointerMove);

        return () => window.removeEventListener('pointermove', handlePointerMove);
    }, [
        clearCloseTimeout,
        enabled,
        isPinnedOpen,
        isPointerInsidePreview,
        isPreviewOpen,
        openPreview,
        schedulePreviewClose,
        updatePointer,
    ]);

    return {
        closeSidebarPreview: closePreview,
        openSidebarPreview: openPreview,
        scheduleSidebarPreviewClose: schedulePreviewClose,
        showSidebarPreview: enabled && !isPinnedOpen && isPreviewOpen,
    };
}

function getSidebarPreviewWidth(wrapper: HTMLElement | null) {
    if (typeof window === 'undefined' || !wrapper) {
        return 0;
    }

    const width = Number.parseFloat(
        window.getComputedStyle(wrapper).getPropertyValue('--sidebar-width')
    );

    return Number.isFinite(width) ? width : 0;
}
