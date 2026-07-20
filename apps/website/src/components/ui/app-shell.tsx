'use client';

import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';
import type React from 'react';
import { cn } from '../../lib/utils.ts';
import { canStartWindowDrag, startCurrentWindowDrag } from '../../lib/window-drag.ts';

const appShellDragRegionHeight = 50;

/**
 * AppShell — root container for the desktop window. The body fills the
 * full window height (sidebar + main both reach y=0); the topbar overlays
 * the top edge so any page-level background extends
 * all the way under the topbar buttons.
 */
export function AppShell({
    className,
    onMouseDown,
    render,
    ...props
}: useRender.ComponentProps<'div'>): React.ReactElement {
    const handleMouseDown: React.MouseEventHandler<HTMLDivElement> = (event) => {
        onMouseDown?.(event);

        if (
            event.defaultPrevented ||
            event.button !== 0 ||
            event.clientY > appShellDragRegionHeight
        ) {
            return;
        }

        const target = event.target instanceof Element ? event.target : event.currentTarget;

        if (!canStartWindowDrag(target)) {
            return;
        }

        void startCurrentWindowDrag().catch((error: unknown) => {
            console.error('Failed to start window dragging.', error);
        });
    };

    const defaultProps = {
        className: cn(
            'app-shell group/app-shell relative flex min-h-screen flex-col overflow-hidden text-foreground md:h-dvh md:min-h-0 md:overscroll-none',
            className
        ),
        'data-slot': 'app-shell',
        onMouseDown: handleMouseDown,
    };

    return useRender({
        defaultTagName: 'div',
        props: mergeProps<'div'>(defaultProps, props),
        render,
    });
}

/**
 * AppShellDragRegion — transparent native drag strip across the top chrome.
 * Top-edge controls opt out with no-drag while empty chrome stays draggable
 * across every page.
 */
export function AppShellDragRegion({
    className,
    ...props
}: React.ComponentProps<'div'>): React.ReactElement {
    return (
        <div
            aria-hidden="true"
            className={cn(
                'app-shell-drag-region pointer-events-none absolute top-0 left-0 z-30 h-[50px] w-full cursor-default select-none',
                className
            )}
            data-slot="app-shell-drag-region"
            data-window-drag-region=""
            {...props}
        />
    );
}

/**
 * AppShellContentHeader — top-aligned page chrome inside the main column.
 * The header is draggable in blank space; buttons and links opt out through
 * shared no-drag styles.
 */
export function AppShellContentHeader({
    className,
    render,
    ...props
}: useRender.ComponentProps<'div'>): React.ReactElement {
    const defaultProps = {
        className: cn(
            'relative z-40 flex h-[var(--topbar-height)] shrink-0 items-start gap-2 px-4 pt-[11px]',
            className
        ),
        'data-slot': 'app-shell-content-header',
        'data-window-drag-region': '',
    };

    return useRender({
        defaultTagName: 'div',
        props: mergeProps<'div'>(defaultProps, props),
        render,
    });
}

/**
 * AppShellBody — flex row holding the sidebar and main column, both
 * reaching the full window height.
 */
export function AppShellBody({
    className,
    render,
    ...props
}: useRender.ComponentProps<'div'>): React.ReactElement {
    const defaultProps = {
        className: cn('flex min-h-0 flex-1 flex-col pt-[var(--topbar-height)]', className),
        'data-slot': 'app-shell-body',
    };

    return useRender({
        defaultTagName: 'div',
        props: mergeProps<'div'>(defaultProps, props),
        render,
    });
}

/**
 * AppShellMain — one opaque, bordered content surface.
 */
export function AppShellMain({ className, ...props }: React.ComponentProps<'main'>) {
    return (
        <main
            className={cn(
                'app-shell-main relative mx-[3px] mb-[3px] flex min-h-0 flex-1 flex-col overflow-hidden border-[var(--content-card-border)] bg-[var(--content-card)] md:rounded-[var(--main-radius)] md:border',
                className
            )}
            data-slot="app-shell-main"
            {...props}
        />
    );
}
