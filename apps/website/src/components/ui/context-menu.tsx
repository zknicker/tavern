'use client';

import { ContextMenu as ContextMenuPrimitive } from '@base-ui/react/context-menu';
import type * as React from 'react';
import { cn } from '../../lib/utils.ts';
import { MenuItem, MenuSeparator, MenuSub, MenuSubPopup, MenuSubTrigger } from './menu.tsx';

export function ContextMenu({
    children,
    modal: _modal = false,
}: {
    children: React.ReactNode;
    modal?: boolean;
}): React.ReactElement {
    return <ContextMenuPrimitive.Root>{children}</ContextMenuPrimitive.Root>;
}

export function ContextMenuTrigger({
    children,
    className,
    ...props
}: ContextMenuPrimitive.Trigger.Props): React.ReactElement {
    return (
        <ContextMenuPrimitive.Trigger
            className={cn(className)}
            data-slot="context-menu-trigger"
            {...props}
        >
            {children}
        </ContextMenuPrimitive.Trigger>
    );
}

export function ContextMenuPopup({
    anchor,
    align = 'start',
    alignOffset,
    children,
    className,
    side = 'bottom',
    sideOffset = 0,
    ...props
}: ContextMenuPrimitive.Popup.Props & {
    align?: ContextMenuPrimitive.Positioner.Props['align'];
    sideOffset?: ContextMenuPrimitive.Positioner.Props['sideOffset'];
    alignOffset?: ContextMenuPrimitive.Positioner.Props['alignOffset'];
    side?: ContextMenuPrimitive.Positioner.Props['side'];
    anchor?: ContextMenuPrimitive.Positioner.Props['anchor'];
}): React.ReactElement {
    return (
        <ContextMenuPrimitive.Portal>
            <ContextMenuPrimitive.Positioner
                align={align}
                alignOffset={alignOffset}
                anchor={anchor}
                className="z-50"
                data-slot="context-menu-positioner"
                side={side}
                sideOffset={sideOffset}
            >
                <ContextMenuPrimitive.Popup
                    className={cn(
                        'relative flex w-[152px] rounded-[14px] border border-black/15 bg-[#f7f7f8]/95 shadow-[0_16px_40px_rgb(0_0_0_/_0.18),0_2px_10px_rgb(0_0_0_/_0.10)] outline-none backdrop-blur-xl dark:border-white/12 dark:bg-[#2b2b2d]/92',
                        className
                    )}
                    data-slot="context-menu-popup"
                    {...props}
                >
                    <div className="max-h-(--available-height) w-full overflow-y-auto p-1">
                        {children}
                    </div>
                </ContextMenuPrimitive.Popup>
            </ContextMenuPrimitive.Positioner>
        </ContextMenuPrimitive.Portal>
    );
}

export function ContextMenuItem({
    className,
    ...props
}: React.ComponentProps<typeof MenuItem>): React.ReactElement {
    return (
        <MenuItem
            className={cn(
                'data-highlighted:!bg-[#0A84FF] data-highlighted:!text-white min-h-7 gap-2.5 rounded-[7px] py-0.5 ps-3 pe-3 font-normal text-sm',
                className
            )}
            {...props}
        />
    );
}

export function ContextMenuSeparator({
    className,
    ...props
}: React.ComponentProps<typeof MenuSeparator>): React.ReactElement {
    return (
        <MenuSeparator
            className={cn('mx-1 my-1 bg-black/12 dark:bg-white/14', className)}
            {...props}
        />
    );
}

export const ContextMenuSub = MenuSub;

export function ContextMenuSubTrigger({
    className,
    ...props
}: React.ComponentProps<typeof MenuSubTrigger>): React.ReactElement {
    return (
        <MenuSubTrigger
            className={cn(
                'data-highlighted:!bg-[#0A84FF] data-highlighted:!text-white data-popup-open:!bg-[#0A84FF] data-popup-open:!text-white min-h-7 gap-2.5 rounded-[7px] py-0.5 ps-3 pe-2 font-normal text-sm',
                className
            )}
            closeDelay={160}
            delay={40}
            openOnHover
            {...props}
        />
    );
}

export function ContextMenuSubPopup({
    className,
    ...props
}: React.ComponentProps<typeof MenuSubPopup>): React.ReactElement {
    return (
        <MenuSubPopup
            className={cn(
                'w-[152px] rounded-[14px] border-black/15 bg-[#f7f7f8]/95 shadow-[0_16px_40px_rgb(0_0_0_/_0.18),0_2px_10px_rgb(0_0_0_/_0.10)] backdrop-blur-xl before:hidden dark:border-white/12 dark:bg-[#2b2b2d]/92 [&>div]:p-1',
                className
            )}
            {...props}
        />
    );
}
