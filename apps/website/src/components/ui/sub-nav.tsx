'use client';

import type { useRender } from '@base-ui/react/use-render';
import type React from 'react';
import { cn } from '../../lib/utils.ts';
import { Nav, NavItem, NavSectionLabel } from './nav.tsx';
import { ScrollArea } from './scroll-area.tsx';

export function SubNav({
    children,
    className,
}: {
    children: React.ReactNode;
    className?: string;
}): React.ReactElement {
    return (
        <aside
            className={cn('flex w-[220px] shrink-0 flex-col border-border/60 border-r', className)}
            style={
                {
                    '--nav-hover': 'var(--subnav-hover)',
                    '--nav-active': 'var(--subnav-active)',
                } as React.CSSProperties
            }
        >
            <ScrollArea className="flex-1">
                <div className="px-3 pt-4 pb-2">{children}</div>
            </ScrollArea>
        </aside>
    );
}

export function SubNavLabel({
    className,
    render,
    ...props
}: useRender.ComponentProps<'div'>): React.ReactElement {
    return <NavSectionLabel className={cn('mb-2 px-2.5', className)} render={render} {...props} />;
}

export function SubNavItem({
    className,
    render,
    ...props
}: useRender.ComponentProps<'button'> & {
    active?: boolean;
}): React.ReactElement {
    return <NavItem className={className} render={render} {...props} />;
}

export function SubNavGroup({
    children,
    className,
}: {
    children: React.ReactNode;
    className?: string;
}): React.ReactElement {
    return <Nav className={cn('flex flex-col gap-px space-y-0', className)}>{children}</Nav>;
}

export function SubNavTree({
    children,
    className,
    expanded,
}: {
    children: React.ReactNode;
    className?: string;
    expanded: boolean;
}): React.ReactElement {
    return (
        <div
            aria-hidden={!expanded}
            className={cn(
                'grid overflow-hidden transition-[grid-template-rows,opacity] duration-180 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none',
                expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
                className
            )}
        >
            <div className="min-h-0 overflow-hidden">
                <div
                    className={cn(
                        '-mt-0.5 ml-[18px] transition-[transform,opacity] duration-180 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none',
                        expanded
                            ? 'translate-y-0 opacity-100'
                            : 'pointer-events-none -translate-y-1 opacity-0'
                    )}
                >
                    {children}
                </div>
            </div>
        </div>
    );
}

export function SubNavTreeItem({
    className,
    isLast = false,
    render,
    ...props
}: useRender.ComponentProps<'button'> & {
    active?: boolean;
    isLast?: boolean;
}): React.ReactElement {
    const active = props.active ?? false;

    return (
        <div className="relative flex items-stretch">
            <div className="relative w-3.5 shrink-0">
                <div
                    className={cn(
                        'absolute left-0 w-px bg-border/50',
                        isLast ? 'top-0 h-[50%]' : 'inset-y-0'
                    )}
                />
                <div className="absolute top-[50%] left-0 h-px w-full bg-border/50" />
            </div>
            <NavItem
                active={active}
                className={cn(
                    'gap-2 transition-colors duration-150 ease-out motion-reduce:transition-none',
                    !active && 'text-muted-foreground hover:text-foreground',
                    className
                )}
                render={render}
                {...props}
            />
        </div>
    );
}
