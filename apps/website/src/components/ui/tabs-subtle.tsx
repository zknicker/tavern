'use client';

import { Tabs as TabsPrimitive } from '@base-ui/react/tabs';
import type { IconSvgElement } from '@hugeicons/react';
import type React from 'react';
import { cn } from '../../lib/utils.ts';
import { Icon } from './icon.tsx';

export function TabsSubtle({ className, ...props }: TabsPrimitive.Root.Props): React.ReactElement {
    return (
        <TabsPrimitive.Root
            className={cn('flex min-w-0 items-center', className)}
            data-slot="tabs-subtle"
            {...props}
        />
    );
}

export function TabsSubtleList({
    className,
    children,
    showIndicator = true,
    ...props
}: TabsPrimitive.List.Props & {
    showIndicator?: boolean;
}): React.ReactElement {
    return (
        <TabsPrimitive.List
            className={cn(
                'relative z-0 flex items-center gap-0.5 overflow-hidden rounded-lg',
                className
            )}
            data-slot="tabs-subtle-list"
            {...props}
        >
            {children}
            {showIndicator ? (
                <TabsPrimitive.Indicator
                    className="absolute bottom-0 left-0 -z-1 h-(--active-tab-height) w-(--active-tab-width) translate-x-(--active-tab-left) -translate-y-(--active-tab-bottom) rounded-lg bg-[var(--topbar-tab-active)] transition-[width,translate,background-color] duration-200 ease-out will-change-[translate,width]"
                    data-slot="tabs-subtle-indicator"
                />
            ) : null}
        </TabsPrimitive.List>
    );
}

export function TabsSubtleItem({
    className,
    icon,
    iconNode,
    iconOnly = false,
    label,
    children,
    ...props
}: TabsPrimitive.Tab.Props & {
    icon?: IconSvgElement;
    iconNode?: React.ReactNode;
    iconOnly?: boolean;
    label: string;
}): React.ReactElement {
    return (
        <TabsPrimitive.Tab
            aria-label={iconOnly ? label : undefined}
            className={cn(
                'no-drag group relative z-10 flex h-7 shrink-0 cursor-pointer items-center justify-center gap-1 whitespace-nowrap rounded-lg bg-transparent px-2 font-medium text-primary text-sm outline-none transition-colors duration-150 ease-out before:pointer-events-none before:absolute before:inset-0 before:z-0 before:rounded-lg before:bg-[var(--topbar-tab-hover)] before:opacity-0 before:transition-opacity before:duration-150 before:ease-out hover:text-primary hover:before:opacity-100 focus-visible:ring-2 focus-visible:ring-ring data-active:bg-transparent data-active:text-primary data-active:before:bg-[var(--topbar-tab-active)] [&>*]:relative [&>*]:z-10 [&_svg]:pointer-events-none [&_svg]:shrink-0',
                iconOnly && 'w-8 px-0',
                className
            )}
            data-slot="tabs-subtle-item"
            {...props}
        >
            {iconNode ?? null}
            {icon && !iconNode ? (
                <Icon
                    aria-hidden="true"
                    className="size-4.5 opacity-70 transition-opacity duration-150 group-data-active:opacity-90"
                    icon={icon}
                    size={18}
                />
            ) : null}
            {iconOnly
                ? null
                : (children ?? (
                      <span className="flex min-h-0 items-center leading-none">{label}</span>
                  ))}
        </TabsPrimitive.Tab>
    );
}
