'use client';

import { ScrollArea as ScrollAreaPrimitive } from '@base-ui/react/scroll-area';
import {
    ArrowDown01Icon,
    ArrowLeft01Icon,
    ArrowRight01Icon,
    ArrowUp01Icon,
} from '@hugeicons-pro/core-solid-rounded';
import type React from 'react';
import { type CSSProperties, type RefObject, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '../../lib/utils.ts';
import { Icon } from './icon.tsx';
import { useSurface } from './surface.tsx';

type ScrollOrientation = 'vertical' | 'horizontal' | 'both';
type ScrollEdge = 'top' | 'bottom' | 'left' | 'right';
type ScrollEdgeCueSize = 'tight' | 'comfortable';

interface ScrollEdges {
    bottom: boolean;
    left: boolean;
    right: boolean;
    top: boolean;
}

const noEdges: ScrollEdges = {
    top: false,
    bottom: false,
    left: false,
    right: false,
};

const cueSizes: Record<ScrollEdgeCueSize, number> = {
    tight: 32,
    comfortable: 60,
};

const cueIcons = {
    top: ArrowUp01Icon,
    bottom: ArrowDown01Icon,
    left: ArrowLeft01Icon,
    right: ArrowRight01Icon,
} as const;

export function ScrollArea({
    className,
    children,
    scrollFade = false,
    scrollbarGutter = false,
    cueSize = 'comfortable',
    chevron = true,
    orientation = 'both',
    viewportClassName,
    viewportRef,
    ...props
}: ScrollAreaPrimitive.Root.Props & {
    chevron?: boolean;
    cueSize?: ScrollEdgeCueSize;
    orientation?: ScrollOrientation;
    scrollFade?: boolean;
    scrollbarGutter?: boolean;
    viewportClassName?: string;
    viewportRef?: React.Ref<HTMLDivElement>;
}): React.ReactElement {
    const internalViewportRef = useRef<HTMLDivElement | null>(null);
    const edges = useScrollEdges(internalViewportRef, {
        enabled: scrollFade,
        axis: orientation,
    });

    return (
        <ScrollAreaPrimitive.Root
            className={cn('relative size-full min-h-0 overflow-hidden', className)}
            data-slot="scroll-area"
            {...props}
        >
            <ScrollAreaPrimitive.Viewport
                className={cn(
                    'size-full rounded-[inherit] outline-none transition-shadows focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background data-has-overflow-y:overscroll-y-contain data-has-overflow-x:overscroll-x-contain',
                    scrollbarGutter && 'data-has-overflow-y:pe-2.5 data-has-overflow-x:pb-2.5',
                    viewportClassName
                )}
                data-slot="scroll-area-viewport"
                ref={(element) => {
                    internalViewportRef.current = element;

                    if (typeof viewportRef === 'function') {
                        viewportRef(element);
                    } else if (viewportRef) {
                        viewportRef.current = element;
                    }
                }}
            >
                <ScrollAreaPrimitive.Content>{children}</ScrollAreaPrimitive.Content>
            </ScrollAreaPrimitive.Viewport>
            {scrollFade ? (
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-[inherit]"
                >
                    {orientation !== 'horizontal' && (
                        <>
                            <ScrollEdgeCue
                                chevron={chevron}
                                edge="top"
                                mode="absolute"
                                size={cueSize}
                                visible={edges.top}
                            />
                            <ScrollEdgeCue
                                chevron={chevron}
                                edge="bottom"
                                mode="absolute"
                                size={cueSize}
                                visible={edges.bottom}
                            />
                        </>
                    )}
                    {orientation !== 'vertical' && (
                        <>
                            <ScrollEdgeCue
                                chevron={chevron}
                                edge="left"
                                mode="absolute"
                                size={cueSize}
                                visible={edges.left}
                            />
                            <ScrollEdgeCue
                                chevron={chevron}
                                edge="right"
                                mode="absolute"
                                size={cueSize}
                                visible={edges.right}
                            />
                        </>
                    )}
                </div>
            ) : null}
            <ScrollBar orientation="vertical" />
            <ScrollBar orientation="horizontal" />
            <ScrollAreaPrimitive.Corner data-slot="scroll-area-corner" />
        </ScrollAreaPrimitive.Root>
    );
}

export function ScrollBar({
    className,
    orientation = 'vertical',
    ...props
}: ScrollAreaPrimitive.Scrollbar.Props): React.ReactElement {
    return (
        <ScrollAreaPrimitive.Scrollbar
            className={cn(
                'absolute z-20 flex touch-none select-none opacity-0 transition-opacity delay-160 duration-120 ease-out data-[orientation=vertical]:top-0 data-[orientation=vertical]:right-0 data-[orientation=horizontal]:bottom-0 data-[orientation=horizontal]:left-0 data-[orientation=horizontal]:h-2.5 data-[orientation=vertical]:h-full data-[orientation=horizontal]:w-full data-[orientation=vertical]:w-2.5 data-[orientation=horizontal]:flex-col data-hovering:opacity-100 data-scrolling:opacity-100 data-hovering:delay-0 data-scrolling:delay-0 data-hovering:duration-160 data-scrolling:duration-160',
                className
            )}
            data-slot="scroll-area-scrollbar"
            orientation={orientation}
            {...props}
        >
            <ScrollAreaPrimitive.Thumb
                className={cn(
                    'active:!bg-foreground/60 relative rounded-full bg-foreground/25 transition-[background-color,width,height] duration-160 ease-in-out group-hover/scrollbar:bg-foreground/45',
                    orientation === 'vertical' &&
                        'mx-auto my-1 h-[var(--scroll-area-thumb-height)] w-1 group-hover/scrollbar:w-1.5',
                    orientation === 'horizontal' &&
                        'mx-1 my-auto h-1 w-[var(--scroll-area-thumb-width)] group-hover/scrollbar:h-1.5'
                )}
                data-slot="scroll-area-thumb"
            />
        </ScrollAreaPrimitive.Scrollbar>
    );
}

function useScrollEdges(
    ref: RefObject<HTMLElement | null>,
    { enabled = true, axis = 'vertical' }: { axis?: ScrollOrientation; enabled?: boolean } = {}
): ScrollEdges {
    const [edges, setEdges] = useState<ScrollEdges>(noEdges);

    useEffect(() => {
        if (!enabled) {
            setEdges(noEdges);
            return;
        }

        const element = ref.current;

        if (!element) {
            return;
        }

        let mutationFrame = 0;

        const update = () => {
            const next = { ...noEdges };

            if (axis !== 'horizontal') {
                const { clientHeight, scrollHeight, scrollTop } = element;
                const overflowing = scrollHeight - clientHeight > 1;
                next.top = overflowing && scrollTop > 1;
                next.bottom = overflowing && scrollTop + clientHeight < scrollHeight - 1;
            }

            if (axis !== 'vertical') {
                const { clientWidth, scrollLeft, scrollWidth } = element;
                const overflowing = scrollWidth - clientWidth > 1;
                next.left = overflowing && scrollLeft > 1;
                next.right = overflowing && scrollLeft + clientWidth < scrollWidth - 1;
            }

            setEdges((previous) =>
                previous.top === next.top &&
                previous.bottom === next.bottom &&
                previous.left === next.left &&
                previous.right === next.right
                    ? previous
                    : next
            );
        };

        const scheduleUpdate = () => {
            if (mutationFrame) {
                return;
            }

            mutationFrame = requestAnimationFrame(() => {
                mutationFrame = 0;
                update();
            });
        };

        update();
        const layoutFrame = requestAnimationFrame(update);
        const resizeObserver = new ResizeObserver(update);
        const mutationObserver = new MutationObserver(scheduleUpdate);

        element.addEventListener('scroll', update, { passive: true });
        resizeObserver.observe(element);
        mutationObserver.observe(element, {
            childList: true,
            characterData: true,
            subtree: true,
        });

        return () => {
            cancelAnimationFrame(layoutFrame);

            if (mutationFrame) {
                cancelAnimationFrame(mutationFrame);
            }

            element.removeEventListener('scroll', update);
            resizeObserver.disconnect();
            mutationObserver.disconnect();
        };
    }, [axis, enabled, ref]);

    return edges;
}

function ScrollEdgeCue({
    chevron = true,
    edge,
    mode = 'sticky',
    size = 'comfortable',
    surfaceLevel,
    visible,
}: {
    chevron?: boolean;
    edge: ScrollEdge;
    mode?: 'absolute' | 'sticky';
    size?: ScrollEdgeCueSize;
    surfaceLevel?: number;
    visible: boolean;
}) {
    const contextLevel = useSurface();
    const level = Math.max(1, Math.min(8, surfaceLevel ?? contextLevel));
    const surface = `var(--surface-${level})`;
    const isVertical = edge === 'top' || edge === 'bottom';
    const sizePx = cueSizes[size];
    const IconComponent = cueIcons[edge];

    const bandStyle = useMemo(
        () =>
            ({
                position: 'absolute',
                opacity: visible ? 1 : 0,
                transition: `opacity ${visible ? 160 : 120}ms ease`,
                ...(mode === 'sticky'
                    ? isVertical
                        ? { left: -4, right: -4, [edge]: -4, height: sizePx }
                        : { top: -4, bottom: -4, [edge]: -4, width: sizePx }
                    : isVertical
                      ? { left: 0, right: 0, [edge]: 0, height: sizePx }
                      : { top: 0, bottom: 0, [edge]: 0, width: sizePx }),
            }) as CSSProperties,
        [edge, isVertical, mode, sizePx, visible]
    );

    const iconStyle = useMemo(
        () =>
            ({
                position: 'absolute',
                ...(isVertical
                    ? { left: '50%', transform: 'translateX(-50%)' }
                    : { top: '50%', transform: 'translateY(-50%)' }),
                [edge]: 8,
            }) as CSSProperties,
        [edge, isVertical]
    );

    const band = (
        <div style={bandStyle}>
            <div
                className="absolute inset-0"
                style={{
                    background: `linear-gradient(to ${edge}, transparent 0%, color-mix(in srgb, ${surface} 75%, transparent) 65%, ${surface} 100%)`,
                }}
            />
            {chevron ? (
                <Icon
                    className="absolute size-4 text-muted-foreground"
                    icon={IconComponent}
                    style={iconStyle}
                />
            ) : null}
        </div>
    );

    if (mode === 'absolute') {
        return <div aria-hidden>{band}</div>;
    }

    return (
        <div
            aria-hidden
            style={
                {
                    position: 'sticky',
                    [edge]: 0,
                    ...(isVertical ? { height: 0 } : { width: 0 }),
                    zIndex: 30,
                    pointerEvents: 'none',
                } as CSSProperties
            }
        >
            {band}
        </div>
    );
}

export { ScrollAreaPrimitive, ScrollEdgeCue, useScrollEdges };
export type { ScrollEdgeCueSize, ScrollEdges, ScrollOrientation };
