import * as React from 'react';
import { cn } from '../../lib/utils.ts';

type ResizeSide = 'left' | 'right';

interface ResizablePaneRailProps extends Omit<React.ComponentProps<'button'>, 'onChange'> {
    maxWidth: number;
    minWidth: number;
    onResizeEnd?: () => void;
    onResizeStart?: () => void;
    onWidthChange: (width: number) => void;
    onWidthCommit?: (width: number) => void;
    side: ResizeSide;
    width: number;
}

export function ResizablePaneRail({
    className,
    maxWidth,
    minWidth,
    onResizeEnd,
    onResizeStart,
    onWidthChange,
    onWidthCommit,
    side,
    width,
    ...props
}: ResizablePaneRailProps) {
    return (
        <button
            aria-label={props['aria-label'] ?? 'Resize pane'}
            className={cn(
                'absolute inset-y-0 z-20 hidden w-3 cursor-col-resize sm:flex',
                side === 'right' ? '-right-1.5' : '-left-1.5',
                'before:pointer-events-none before:absolute before:inset-y-0 before:left-1/2 before:w-px before:-translate-x-1/2 before:bg-[var(--color-neutral-400)] before:opacity-0 before:transition-opacity before:duration-150 hover:before:opacity-100',
                'before:[mask-image:linear-gradient(to_bottom,transparent_0,black_calc(var(--main-radius)+88px),black_calc(100%-var(--main-radius)-88px),transparent_100%)]',
                className
            )}
            onClick={(event) => event.preventDefault()}
            onPointerDown={(event) => {
                if (event.button !== 0) {
                    return;
                }

                event.preventDefault();

                const rail = event.currentTarget;
                const startX = event.clientX;
                const startWidth = width;
                let currentWidth = startWidth;

                rail.setPointerCapture(event.pointerId);
                onResizeStart?.();

                const handlePointerMove = (moveEvent: PointerEvent) => {
                    const delta = moveEvent.clientX - startX;
                    const nextWidth = side === 'right' ? startWidth + delta : startWidth - delta;

                    currentWidth = clampPaneWidth(nextWidth, minWidth, maxWidth);
                    onWidthChange(currentWidth);
                };

                const handlePointerUp = (upEvent: PointerEvent) => {
                    if (rail.hasPointerCapture(upEvent.pointerId)) {
                        rail.releasePointerCapture(upEvent.pointerId);
                    }

                    onWidthCommit?.(currentWidth);
                    onResizeEnd?.();
                    window.removeEventListener('pointermove', handlePointerMove);
                    window.removeEventListener('pointerup', handlePointerUp);
                    window.removeEventListener('pointercancel', handlePointerUp);
                };

                window.addEventListener('pointermove', handlePointerMove);
                window.addEventListener('pointerup', handlePointerUp, { once: true });
                window.addEventListener('pointercancel', handlePointerUp, { once: true });
            }}
            tabIndex={-1}
            title={props.title ?? 'Resize pane'}
            type="button"
            {...props}
        />
    );
}

export function useResizablePaneWidth({
    defaultWidth,
    maxWidth,
    minWidth,
    storageKey,
}: {
    defaultWidth: number;
    maxWidth: number;
    minWidth: number;
    storageKey: string;
}) {
    const [width, setWidthState] = React.useState(() =>
        getInitialPaneWidth(storageKey, defaultWidth, minWidth, maxWidth)
    );

    const setWidth = React.useCallback(
        (nextWidth: number) => {
            setWidthState(clampPaneWidth(nextWidth, minWidth, maxWidth));
        },
        [maxWidth, minWidth]
    );

    const persistWidth = React.useCallback(
        (nextWidth: number) => {
            const clampedWidth = clampPaneWidth(nextWidth, minWidth, maxWidth);
            setWidthState(clampedWidth);
            window.localStorage.setItem(storageKey, String(clampedWidth));
        },
        [maxWidth, minWidth, storageKey]
    );

    return { persistWidth, setWidth, width };
}

function getInitialPaneWidth(
    storageKey: string,
    defaultWidth: number,
    minWidth: number,
    maxWidth: number
) {
    if (typeof window === 'undefined') {
        return defaultWidth;
    }

    const saved = Number(window.localStorage.getItem(storageKey));

    return Number.isFinite(saved) ? clampPaneWidth(saved, minWidth, maxWidth) : defaultWidth;
}

function clampPaneWidth(width: number, minWidth: number, maxWidth: number) {
    return Math.min(maxWidth, Math.max(minWidth, Math.round(width)));
}
