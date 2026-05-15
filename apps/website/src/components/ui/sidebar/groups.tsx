'use client';

import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';
import type * as React from 'react';
import { cn } from '../../../lib/utils.ts';
import { Input } from '../primitives/input.tsx';
import { Separator } from '../separator.tsx';

export function SidebarInput({ className, ...props }: React.ComponentProps<typeof Input>) {
    return (
        <Input
            className={cn('h-8 w-full bg-background shadow-none', className)}
            data-sidebar="input"
            data-slot="sidebar-input"
            {...props}
        />
    );
}

export function SidebarSeparator({ className, ...props }: React.ComponentProps<typeof Separator>) {
    return (
        <Separator
            className={cn('mx-2 w-auto bg-sidebar-border', className)}
            data-sidebar="separator"
            data-slot="sidebar-separator"
            {...props}
        />
    );
}

export function SidebarGroup({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            className={cn('relative flex w-full min-w-0 flex-col p-2', className)}
            data-sidebar="group"
            data-slot="sidebar-group"
            {...props}
        />
    );
}

export function SidebarGroupLabel({
    className,
    render,
    ...props
}: useRender.ComponentProps<'div'> & React.ComponentProps<'div'>) {
    return useRender({
        defaultTagName: 'div',
        props: mergeProps<'div'>(
            {
                className: cn(
                    'flex h-8 shrink-0 items-center rounded-md px-2 font-medium text-[var(--nav-section-label)] text-sm outline-hidden ring-sidebar-ring transition-[margin,opacity] duration-200 ease-linear focus-visible:ring-2 group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0 [&>svg]:size-4.5 [&>svg]:shrink-0',
                    className
                ),
            },
            props
        ),
        render,
        state: {
            slot: 'sidebar-group-label',
            sidebar: 'group-label',
        },
    });
}

export function SidebarGroupAction({
    className,
    render,
    ...props
}: useRender.ComponentProps<'button'> & React.ComponentProps<'button'>) {
    return useRender({
        defaultTagName: 'button',
        props: mergeProps<'button'>(
            {
                className: cn(
                    'absolute top-3.5 right-3 flex aspect-square w-5 items-center justify-center rounded-md p-0 text-sidebar-foreground outline-hidden ring-sidebar-ring transition-transform after:absolute after:-inset-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 group-data-[collapsible=icon]:hidden md:after:hidden [&>svg]:size-4.5 [&>svg]:shrink-0',
                    className
                ),
                type: 'button',
            },
            props
        ),
        render,
        state: {
            slot: 'sidebar-group-action',
            sidebar: 'group-action',
        },
    });
}

export function SidebarGroupContent({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            className={cn('w-full text-sm', className)}
            data-sidebar="group-content"
            data-slot="sidebar-group-content"
            {...props}
        />
    );
}
