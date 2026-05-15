'use client';

import * as React from 'react';
import { cn } from '../../lib/utils.ts';
import { Menu, MenuItem, MenuPopup, MenuSeparator } from './menu.tsx';

interface ContextMenuState {
    anchor: React.ComponentProps<typeof MenuPopup>['anchor'];
    setPoint: (point: ContextMenuPoint | null) => void;
}

interface ContextMenuPoint {
    x: number;
    y: number;
}

const ContextMenuContext = React.createContext<ContextMenuState | null>(null);

export function ContextMenu({
    children,
    modal = false,
}: {
    children: React.ReactNode;
    modal?: boolean;
}): React.ReactElement {
    const [point, setPoint] = React.useState<ContextMenuPoint | null>(null);
    const anchor = React.useMemo<React.ComponentProps<typeof MenuPopup>['anchor']>(() => {
        if (!point) {
            return null;
        }

        return {
            getBoundingClientRect: () =>
                DOMRect.fromRect({
                    height: 0,
                    width: 0,
                    x: point.x,
                    y: point.y,
                }),
        };
    }, [point]);

    const value = React.useMemo(() => ({ anchor, setPoint }), [anchor]);

    return (
        <ContextMenuContext.Provider value={value}>
            <Menu
                modal={modal}
                onOpenChange={(open, eventDetails) => {
                    if (open) {
                        return;
                    }

                    if (shouldCloseContextMenu(eventDetails.reason)) {
                        setPoint(null);
                    }
                }}
                open={point !== null}
            >
                {children}
            </Menu>
        </ContextMenuContext.Provider>
    );
}

export function ContextMenuTrigger({
    children,
    className,
    onContextMenu,
    ...props
}: React.ComponentProps<'div'>): React.ReactElement {
    const context = useContextMenu();

    return (
        // biome-ignore lint/a11y/noStaticElementInteractions: The wrapper catches secondary-click; children keep their primary keyboard semantics.
        <div
            className={cn(className)}
            data-slot="context-menu-trigger"
            onContextMenu={(event) => {
                onContextMenu?.(event);

                if (event.defaultPrevented) {
                    return;
                }

                event.preventDefault();
                context.setPoint({ x: event.clientX, y: event.clientY });
            }}
            role="presentation"
            {...props}
        >
            {children}
        </div>
    );
}

export function ContextMenuPopup({
    anchor,
    align = 'start',
    className,
    sideOffset = 0,
    ...props
}: React.ComponentProps<typeof MenuPopup>): React.ReactElement {
    const context = useContextMenu();

    return (
        <MenuPopup
            align={align}
            anchor={anchor ?? context.anchor}
            className={cn(
                'w-[152px] rounded-[14px] border-black/15 bg-[#f7f7f8]/95 shadow-[0_16px_40px_rgb(0_0_0_/_0.18),0_2px_10px_rgb(0_0_0_/_0.10)] backdrop-blur-xl before:hidden dark:border-white/12 dark:bg-[#2b2b2d]/92 [&>div]:p-1.5',
                className
            )}
            sideOffset={sideOffset}
            {...props}
        />
    );
}

function useContextMenu() {
    const context = React.useContext(ContextMenuContext);

    if (!context) {
        throw new Error('ContextMenu parts must be used inside ContextMenu.');
    }

    return context;
}

function shouldCloseContextMenu(reason: string) {
    return ['escape-key', 'item-press', 'outside-press'].includes(reason);
}

export function ContextMenuItem({
    className,
    ...props
}: React.ComponentProps<typeof MenuItem>): React.ReactElement {
    return (
        <MenuItem
            className={cn(
                'data-highlighted:!bg-[#0A84FF] data-highlighted:!text-white min-h-6 gap-3 rounded-[7px] py-0.5 ps-4 pe-4 font-[450] text-meta sm:min-h-6 sm:text-meta',
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
            className={cn('mx-4 my-1.5 bg-black/12 dark:bg-white/14', className)}
            {...props}
        />
    );
}
