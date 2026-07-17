'use client';

import { Tabs as TabsPrimitive } from '@base-ui/react/tabs';
import type { IconSvgElement } from '@hugeicons/react';
import { AnimatePresence, motion } from 'framer-motion';
import * as React from 'react';
import { useProximityHover } from '../../hooks/use-proximity-hover.ts';
import { fontWeights } from '../../lib/font-weight.ts';
import { springs } from '../../lib/springs.ts';
import { cn } from '../../lib/utils.ts';
import { Icon } from './icon.tsx';

export type TabsSubtleVariant = 'default' | 'underline';
export type TabsSubtleSize = 'sm' | 'default' | 'lg';

interface TabsListContextValue {
    setOptimisticIndex: (index: number) => void;
}

const TabsListContext = React.createContext<TabsListContextValue | null>(null);

export function TabsSubtle({ className, ...props }: TabsPrimitive.Root.Props): React.ReactElement {
    return (
        <TabsPrimitive.Root
            className={cn('flex flex-col gap-2 data-[orientation=vertical]:flex-row', className)}
            data-slot="tabs"
            {...props}
        />
    );
}

export function TabsSubtleList({
    variant = 'default',
    className,
    children,
    showIndicator = true,
    ...props
}: TabsPrimitive.List.Props & {
    showIndicator?: boolean;
    variant?: TabsSubtleVariant;
}): React.ReactElement {
    const containerRef = React.useRef<HTMLDivElement | null>(null);
    const isMouseInside = React.useRef(false);
    const registeredTabCountRef = React.useRef(0);
    const [selectedIndex, setSelectedIndex] = React.useState<number | null>(null);
    const [optimisticIndex, setOptimisticIndex] = React.useState<number | null>(null);
    const [focusedIndex, setFocusedIndex] = React.useState<number | null>(null);
    const {
        activeIndex: hoveredIndex,
        handlers,
        itemRects,
        measureItems,
        registerItem,
        setActiveIndex: setHoveredIndex,
    } = useProximityHover(containerRef, { axis: 'x' });

    const measureTabs = React.useCallback(() => {
        const container = containerRef.current;

        if (!container) {
            return;
        }

        const tabs = Array.from(container.querySelectorAll<HTMLElement>('[data-slot="tabs-tab"]'));
        const previousCount = registeredTabCountRef.current;

        for (let index = tabs.length; index < previousCount; index += 1) {
            registerItem(index, null);
        }

        tabs.forEach((tab, index) => {
            tab.dataset.proximityIndex = String(index);
            registerItem(index, tab);
        });

        registeredTabCountRef.current = tabs.length;
        const activeIndex = tabs.findIndex((tab) => tab.hasAttribute('data-active'));
        setSelectedIndex(activeIndex >= 0 ? activeIndex : null);
        setOptimisticIndex(activeIndex >= 0 ? activeIndex : null);
        measureItems();
    }, [measureItems, registerItem]);

    React.useEffect(() => {
        measureTabs();
    }, [measureTabs]);

    React.useEffect(() => {
        const container = containerRef.current;

        if (!container) {
            return;
        }

        const observer = new MutationObserver(measureTabs);

        observer.observe(container, {
            attributeFilter: ['data-active', 'data-disabled', 'aria-selected'],
            childList: true,
            subtree: true,
        });

        return () => observer.disconnect();
    }, [measureTabs]);

    React.useEffect(() => {
        const container = containerRef.current;

        if (!container) {
            return;
        }

        const observer = new ResizeObserver(measureTabs);

        observer.observe(container);

        for (const tab of container.querySelectorAll<HTMLElement>('[data-slot="tabs-tab"]')) {
            observer.observe(tab);
        }

        return () => observer.disconnect();
    }, [measureTabs]);

    const selectedRect = optimisticIndex !== null ? itemRects[optimisticIndex] : null;
    const hoverRect = hoveredIndex !== null ? itemRects[hoveredIndex] : null;
    const focusRect = focusedIndex !== null ? itemRects[focusedIndex] : null;
    const isHoveringSelected = hoveredIndex === (optimisticIndex ?? selectedIndex);
    const isHovering = hoveredIndex !== null && !isHoveringSelected;

    return (
        <TabsListContext.Provider value={{ setOptimisticIndex }}>
            <TabsPrimitive.List
                {...props}
                className={cn(
                    'scrollbar-hidden relative z-0 -mx-0.5 flex w-fit max-w-full select-none items-center gap-0.5 overflow-visible px-0.5 py-1 text-muted-foreground',
                    'data-[orientation=vertical]:flex-col',
                    variant === 'underline' && 'pb-1',
                    className
                )}
                data-slot="tabs-list"
                onBlur={(event) => {
                    props.onBlur?.(event);

                    if (event.defaultPrevented) {
                        return;
                    }

                    if (containerRef.current?.contains(event.relatedTarget as Node)) {
                        return;
                    }

                    setFocusedIndex(null);

                    if (!isMouseInside.current) {
                        setHoveredIndex(null);
                    }
                }}
                onFocus={(event) => {
                    props.onFocus?.(event);

                    if (event.defaultPrevented) {
                        return;
                    }

                    const tab = (event.target as HTMLElement).closest<HTMLElement>(
                        '[data-slot="tabs-tab"]'
                    );
                    const indexAttr = tab?.dataset.proximityIndex;

                    if (indexAttr === undefined) {
                        return;
                    }

                    const index = Number(indexAttr);

                    setHoveredIndex(index);
                    setFocusedIndex(
                        (event.target as HTMLElement).matches(':focus-visible') ? index : null
                    );
                }}
                onMouseLeave={(event) => {
                    props.onMouseLeave?.(event);

                    if (event.defaultPrevented) {
                        return;
                    }

                    isMouseInside.current = false;
                    handlers.onMouseLeave();
                }}
                onMouseMove={(event) => {
                    props.onMouseMove?.(event);

                    if (event.defaultPrevented) {
                        return;
                    }

                    isMouseInside.current = true;
                    handlers.onMouseMove(event);
                }}
                ref={(node) => {
                    containerRef.current = node;
                }}
            >
                {showIndicator && selectedRect ? (
                    <motion.div
                        animate={{
                            height: variant === 'underline' ? 2 : selectedRect.height,
                            left: selectedRect.left,
                            opacity: isHovering ? 0.84 : 1,
                            top:
                                variant === 'underline'
                                    ? selectedRect.top + selectedRect.height - 2
                                    : selectedRect.top,
                            width: selectedRect.width,
                        }}
                        className={cn(
                            'pointer-events-none absolute',
                            variant === 'underline'
                                ? 'z-10 rounded-full bg-primary'
                                : 'rounded-lg bg-active'
                        )}
                        data-slot="tabs-indicator"
                        initial={false}
                        transition={{ ...springs.moderate, opacity: { duration: 0.08 } }}
                    />
                ) : null}

                <AnimatePresence>
                    {showIndicator && hoverRect && !isHoveringSelected && selectedRect ? (
                        <motion.div
                            animate={{
                                height:
                                    variant === 'underline'
                                        ? selectedRect.height
                                        : hoverRect.height,
                                left: hoverRect.left,
                                opacity: 0.42,
                                top: hoverRect.top,
                                width: hoverRect.width,
                            }}
                            className="pointer-events-none absolute rounded-lg bg-hover"
                            data-slot="tabs-hover-indicator"
                            exit={
                                isMouseInside.current
                                    ? { opacity: 0, transition: springs.fast }
                                    : {
                                          height: selectedRect.height,
                                          left: selectedRect.left,
                                          opacity: 0,
                                          top: selectedRect.top,
                                          transition: {
                                              ...springs.moderate,
                                              opacity: { duration: 0.06 },
                                          },
                                          width: selectedRect.width,
                                      }
                            }
                            initial={{
                                height: selectedRect.height,
                                left: selectedRect.left,
                                opacity: 0,
                                top: selectedRect.top,
                                width: selectedRect.width,
                            }}
                            transition={{ ...springs.fast, opacity: { duration: 0.08 } }}
                        />
                    ) : null}
                </AnimatePresence>

                <AnimatePresence>
                    {focusRect ? (
                        <motion.div
                            animate={{
                                height: focusRect.height + 4,
                                left: focusRect.left - 2,
                                top: focusRect.top - 2,
                                width: focusRect.width + 4,
                            }}
                            className="pointer-events-none absolute z-20 rounded-lg border border-ring"
                            data-slot="tabs-focus-indicator"
                            exit={{ opacity: 0, transition: springs.fast }}
                            initial={false}
                            transition={{ ...springs.fast, opacity: { duration: 0.08 } }}
                        />
                    ) : null}
                </AnimatePresence>

                {children}
            </TabsPrimitive.List>
        </TabsListContext.Provider>
    );
}

export function TabsSubtleItem({
    size = 'default',
    className,
    children,
    disabled,
    icon,
    iconNode,
    iconOnly = false,
    label,
    onClick,
    tabIndex,
    ...props
}: TabsPrimitive.Tab.Props & {
    icon?: IconSvgElement;
    iconNode?: React.ReactNode;
    iconOnly?: boolean;
    label?: string;
    size?: TabsSubtleSize;
}): React.ReactElement {
    const listContext = React.useContext(TabsListContext);

    return (
        <TabsPrimitive.Tab
            aria-label={iconOnly ? label : props['aria-label']}
            className={cn(
                'no-drag group relative z-10 flex shrink-0 cursor-pointer items-center justify-center gap-2 bg-transparent text-muted-foreground outline-none transition-colors duration-80 hover:text-foreground data-disabled:pointer-events-none data-disabled:cursor-default data-active:text-foreground data-disabled:opacity-50 [&>*]:relative [&>*]:z-10 [&_svg]:pointer-events-none [&_svg]:shrink-0',
                'rounded-lg',
                size === 'sm' && 'h-8 px-3 text-sm',
                size === 'default' && 'h-9 px-3.5 text-sm',
                size === 'lg' && 'h-10 px-4 text-sm',
                iconOnly && 'w-8 px-0',
                className
            )}
            data-slot="tabs-tab"
            data-window-drag-disabled=""
            disabled={disabled}
            onClick={(event) => {
                onClick?.(event);

                if (event.defaultPrevented || disabled) {
                    return;
                }

                const index = Number(event.currentTarget.dataset.proximityIndex);

                if (Number.isFinite(index)) {
                    listContext?.setOptimisticIndex(index);
                }
            }}
            tabIndex={disabled ? undefined : (tabIndex ?? 0)}
            {...props}
        >
            {iconNode ?? null}
            {icon && !iconNode ? (
                <Icon
                    aria-hidden="true"
                    className="size-4 opacity-70 transition-[color,opacity] duration-80 group-data-active:opacity-90"
                    icon={icon}
                    size={16}
                />
            ) : null}
            {iconOnly ? null : (children ?? (label ? <TabsLabel>{label}</TabsLabel> : null))}
        </TabsPrimitive.Tab>
    );
}

export function TabsSubtlePanel({
    className,
    ...props
}: TabsPrimitive.Panel.Props): React.ReactElement {
    return (
        <TabsPrimitive.Panel
            className={cn('flex-1 outline-none', className)}
            data-slot="tabs-content"
            {...props}
        />
    );
}

function TabsLabel({ children }: { children: React.ReactNode }) {
    return (
        <span className="inline-grid whitespace-nowrap text-sm">
            <span
                aria-hidden="true"
                className="invisible col-start-1 row-start-1"
                style={{ fontVariationSettings: fontWeights.semibold }}
            >
                {children}
            </span>
            <span className="col-start-1 row-start-1 font-normal transition-[color,font-weight] duration-80 group-data-active:font-semibold">
                {children}
            </span>
        </span>
    );
}

export { TabsPrimitive, TabsSubtleItem as TabsSubtleTrigger, TabsSubtlePanel as TabsSubtleContent };
