'use client';

import { PanelLeftCloseIcon, PanelLeftOpenIcon } from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { cn } from '../../../lib/utils.ts';
import { Drawer, DrawerPopup } from '../drawer.tsx';
import { Icon } from '../icon.tsx';
import { Button } from '../primitives/button.tsx';
import { SIDEBAR_WIDTH_MOBILE, useSidebar } from './context.tsx';

export function Sidebar({
    side = 'left',
    variant = 'sidebar',
    collapsible = 'offcanvas',
    className,
    children,
    ...props
}: React.ComponentProps<'div'> & {
    side?: 'left' | 'right';
    variant?: 'sidebar' | 'floating' | 'inset';
    collapsible?: 'offcanvas' | 'icon' | 'none';
}) {
    const { isMobile, state, openMobile, setOpenMobile } = useSidebar();

    if (collapsible === 'none') {
        return (
            <div
                className={cn(
                    'flex h-full w-(--sidebar-width) flex-col bg-sidebar text-sidebar-foreground',
                    className
                )}
                data-slot="sidebar"
                {...props}
            >
                {children}
            </div>
        );
    }

    if (isMobile) {
        return (
            <Drawer onOpenChange={setOpenMobile} open={openMobile} position={side}>
                <DrawerPopup
                    className="w-(--sidebar-width) max-w-none border-sidebar-border bg-sidebar p-0 text-sidebar-foreground"
                    data-mobile="true"
                    data-sidebar="sidebar"
                    data-slot="sidebar"
                    position={side}
                    style={{ '--sidebar-width': SIDEBAR_WIDTH_MOBILE } as React.CSSProperties}
                    variant="straight"
                    {...props}
                >
                    <div className="flex h-full w-full flex-col">{children}</div>
                </DrawerPopup>
            </Drawer>
        );
    }

    return (
        <div
            className="group peer hidden text-sidebar-foreground md:block"
            data-collapsible={state === 'collapsed' ? collapsible : ''}
            data-side={side}
            data-slot="sidebar"
            data-state={state}
            data-variant={variant}
        >
            <div
                className={cn(
                    'relative w-(--sidebar-width) bg-transparent',
                    'group-data-[collapsible=offcanvas]:w-0',
                    variant === 'floating' || variant === 'inset'
                        ? 'group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+1rem)]'
                        : 'group-data-[collapsible=icon]:w-(--sidebar-width-icon)'
                )}
                data-slot="sidebar-gap"
            />
            <div
                className={cn(
                    'fixed inset-y-0 z-10 hidden h-svh w-(--sidebar-width) bg-sidebar data-[side=right]:right-0 data-[side=left]:left-0 md:flex',
                    'data-[side=right]:group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)] data-[side=left]:group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)]',
                    variant === 'floating' || variant === 'inset'
                        ? 'p-2 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+1rem+2px)]'
                        : 'group-data-[collapsible=icon]:w-(--sidebar-width-icon) group-data-[side=left]:border-r group-data-[side=right]:border-l',
                    className
                )}
                data-side={side}
                data-slot="sidebar-container"
                {...props}
            >
                <div
                    className="flex size-full flex-col bg-transparent group-data-[variant=floating]:rounded-lg group-data-[variant=floating]:shadow-sm group-data-[variant=floating]:ring-1 group-data-[variant=floating]:ring-sidebar-border"
                    data-sidebar="sidebar"
                    data-slot="sidebar-inner"
                >
                    {children}
                </div>
            </div>
        </div>
    );
}

export function SidebarTrigger({
    activateOnPointerDown = false,
    className,
    onClick,
    onPointerDown,
    ...props
}: React.ComponentProps<typeof Button> & {
    activateOnPointerDown?: boolean;
}) {
    const { state, toggleSidebar } = useSidebar();
    const TriggerIcon = state === 'collapsed' ? PanelLeftCloseIcon : PanelLeftOpenIcon;
    const pointerActivatedRef = React.useRef(false);
    const clearPointerActivated = React.useCallback(() => {
        window.setTimeout(() => {
            pointerActivatedRef.current = false;
        }, 0);
    }, []);

    return (
        <Button
            className={cn(
                'no-drag text-[var(--sidebar-icon-muted)] hover:text-sidebar-foreground',
                className
            )}
            data-sidebar="trigger"
            data-slot="sidebar-trigger"
            onClick={(event) => {
                onClick?.(event);
                if (pointerActivatedRef.current) {
                    pointerActivatedRef.current = false;
                    return;
                }
                toggleSidebar();
            }}
            onPointerCancel={clearPointerActivated}
            onPointerDown={(event) => {
                onPointerDown?.(event);

                if (
                    !activateOnPointerDown ||
                    event.defaultPrevented ||
                    event.button !== 0 ||
                    event.pointerType === 'touch'
                ) {
                    return;
                }

                pointerActivatedRef.current = true;
                event.preventDefault();
                event.stopPropagation();
                toggleSidebar();
            }}
            onPointerUp={clearPointerActivated}
            size="icon"
            variant="ghost"
            {...props}
        >
            <Icon aria-hidden="true" icon={TriggerIcon} />
            <span className="sr-only">Toggle sidebar</span>
        </Button>
    );
}

export function SidebarRail({ className, ...props }: React.ComponentProps<'button'>) {
    const { persistSidebarWidth, setOpen, setSidebarWidth, sidebarWidth, state } = useSidebar();

    return (
        <button
            aria-label="Resize sidebar"
            className={cn(
                'absolute inset-y-0 z-20 hidden w-3 cursor-col-resize group-data-[side=left]:-right-1.5 group-data-[side=right]:-left-1.5 sm:flex',
                'before:pointer-events-none before:absolute before:inset-y-0 before:left-1/2 before:w-px before:-translate-x-1/2 before:bg-[var(--color-neutral-400)] before:opacity-0 before:transition-opacity before:duration-150 hover:before:opacity-100',
                'before:[mask-image:linear-gradient(to_bottom,transparent_0,black_calc(var(--main-radius)+88px),black_calc(100%-var(--main-radius)-88px),transparent_100%)]',
                className
            )}
            data-sidebar="rail"
            data-slot="sidebar-rail"
            onClick={(event) => event.preventDefault()}
            onPointerDown={(event) => {
                if (event.button !== 0) {
                    return;
                }

                event.preventDefault();

                const rail = event.currentTarget;
                const sidebar = rail.closest<HTMLElement>('[data-slot="sidebar"]');
                const side = sidebar?.dataset.side ?? 'left';
                const startX = event.clientX;
                const startWidth = sidebarWidth;
                let currentWidth = startWidth;

                rail.setPointerCapture(event.pointerId);

                if (state === 'collapsed') {
                    setOpen(true);
                }

                const handlePointerMove = (moveEvent: PointerEvent) => {
                    const nextWidth =
                        side === 'right'
                            ? startWidth - (moveEvent.clientX - startX)
                            : startWidth + (moveEvent.clientX - startX);

                    currentWidth = nextWidth;
                    setSidebarWidth(currentWidth);
                };

                const handlePointerUp = (upEvent: PointerEvent) => {
                    if (rail.hasPointerCapture(upEvent.pointerId)) {
                        rail.releasePointerCapture(upEvent.pointerId);
                    }

                    persistSidebarWidth(currentWidth);
                    window.removeEventListener('pointermove', handlePointerMove);
                    window.removeEventListener('pointerup', handlePointerUp);
                    window.removeEventListener('pointercancel', handlePointerUp);
                };

                window.addEventListener('pointermove', handlePointerMove);
                window.addEventListener('pointerup', handlePointerUp, { once: true });
                window.addEventListener('pointercancel', handlePointerUp, { once: true });
            }}
            tabIndex={-1}
            title="Resize sidebar"
            type="button"
            {...props}
        />
    );
}

export function SidebarInset({ className, ...props }: React.ComponentProps<'main'>) {
    return (
        <main
            className={cn(
                'relative flex w-full flex-1 flex-col bg-background md:peer-data-[state=collapsed]:peer-data-[variant=inset]:ml-2 md:peer-data-[variant=inset]:m-2 md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:rounded-xl md:peer-data-[variant=inset]:shadow-sm',
                className
            )}
            data-slot="sidebar-inset"
            {...props}
        />
    );
}

export function SidebarHeader({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            className={cn('flex flex-col gap-2 p-2', className)}
            data-sidebar="header"
            data-slot="sidebar-header"
            {...props}
        />
    );
}

export function SidebarFooter({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            className={cn('flex flex-col gap-2 p-2', className)}
            data-sidebar="footer"
            data-slot="sidebar-footer"
            {...props}
        />
    );
}

export function SidebarContent({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            className={cn(
                'scrollbar-hidden flex min-h-0 flex-1 flex-col gap-0 overflow-auto group-data-[collapsible=icon]:overflow-hidden',
                className
            )}
            data-sidebar="content"
            data-slot="sidebar-content"
            {...props}
        />
    );
}
