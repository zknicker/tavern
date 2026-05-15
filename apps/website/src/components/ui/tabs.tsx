'use client';

import { Tabs as TabsPrimitive } from '@base-ui/react/tabs';
import type React from 'react';
import { cn } from '../../lib/utils.ts';

export type TabsVariant = 'default' | 'underline';
export type TabsSize = 'sm' | 'default' | 'lg';

export function Tabs({ className, ...props }: TabsPrimitive.Root.Props): React.ReactElement {
    return (
        <TabsPrimitive.Root
            className={cn('flex flex-col gap-2 data-[orientation=vertical]:flex-row', className)}
            data-slot="tabs"
            {...props}
        />
    );
}

export function TabsList({
    variant = 'default',
    className,
    children,
    ...props
}: TabsPrimitive.List.Props & {
    variant?: TabsVariant;
}): React.ReactElement {
    return (
        <TabsPrimitive.List
            className={cn(
                'relative z-0 flex w-fit items-center justify-center text-muted-foreground',
                'data-[orientation=vertical]:flex-col',
                variant === 'default'
                    ? 'gap-x-1'
                    : 'gap-x-0.5 data-[orientation=vertical]:px-1 data-[orientation=horizontal]:py-1 *:data-[slot=tabs-tab]:hover:bg-accent',
                className
            )}
            data-slot="tabs-list"
            {...props}
        >
            {children}
            <TabsPrimitive.Indicator
                className={cn(
                    'absolute bottom-0 left-0 h-(--active-tab-height) w-(--active-tab-width) translate-x-(--active-tab-left) -translate-y-(--active-tab-bottom) transition-[width,translate] duration-200 ease-in-out',
                    variant === 'underline'
                        ? 'z-10 bg-primary data-[orientation=horizontal]:h-0.5 data-[orientation=vertical]:w-0.5 data-[orientation=vertical]:-translate-x-px data-[orientation=horizontal]:translate-y-px'
                        : '-z-1 rounded-md border border-input bg-background shadow-none'
                )}
                data-slot="tab-indicator"
            />
        </TabsPrimitive.List>
    );
}

export function TabsTab({
    size = 'default',
    className,
    ...props
}: TabsPrimitive.Tab.Props & {
    size?: TabsSize;
}): React.ReactElement {
    return (
        <TabsPrimitive.Tab
            className={cn(
                "relative flex shrink-0 grow cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-muted-foreground outline-none transition-colors hover:text-foreground/80 focus-visible:ring-2 focus-visible:ring-ring data-disabled:pointer-events-none data-[orientation=vertical]:w-full data-[orientation=vertical]:justify-start data-active:text-foreground data-disabled:opacity-64 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
                size === 'sm' && 'h-8 px-2.5 text-sm',
                size === 'default' && 'h-9 px-3 font-medium text-sm',
                size === 'lg' && 'h-10 px-3 font-medium text-sm',
                className
            )}
            data-slot="tabs-tab"
            data-window-drag-disabled=""
            {...props}
        />
    );
}

export function TabsPanel({ className, ...props }: TabsPrimitive.Panel.Props): React.ReactElement {
    return (
        <TabsPrimitive.Panel
            className={cn('flex-1 outline-none', className)}
            data-slot="tabs-content"
            {...props}
        />
    );
}

export { TabsPrimitive, TabsTab as TabsTrigger, TabsPanel as TabsContent };
