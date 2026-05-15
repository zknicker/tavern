'use client';

import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';
import { AgentAvatar } from '@tavern/agent-avatars';
import type React from 'react';
import { cn } from '../../lib/utils.ts';

export function Nav({
    className,
    render,
    ...props
}: useRender.ComponentProps<'nav'>): React.ReactElement {
    const defaultProps = {
        className: cn('flex flex-col gap-px', className),
        'data-slot': 'nav',
    };

    return useRender({
        defaultTagName: 'nav',
        props: mergeProps<'nav'>(defaultProps, props),
        render,
    });
}

export function NavSectionLabel({
    className,
    render,
    ...props
}: useRender.ComponentProps<'div'>): React.ReactElement {
    const defaultProps = {
        className: cn(
            'px-2 pt-4 pb-1 font-medium text-[var(--nav-section-label)] text-caption tracking-normal',
            className
        ),
        'data-slot': 'nav-section-label',
    };

    return useRender({
        defaultTagName: 'div',
        props: mergeProps<'div'>(defaultProps, props),
        render,
    });
}

export function NavItem({
    active = false,
    className,
    render,
    ...props
}: useRender.ComponentProps<'button'> & {
    active?: boolean;
}): React.ReactElement {
    const typeValue: React.ButtonHTMLAttributes<HTMLButtonElement>['type'] = render
        ? undefined
        : 'button';

    const defaultProps = {
        className: cn(
            'no-drag group relative flex w-full items-center gap-2 rounded-md px-2 py-1 text-left font-medium text-meta transition-colors duration-150 ease-out',
            active
                ? 'bg-[var(--nav-active)] text-foreground duration-0'
                : 'text-foreground/75 hover:bg-[var(--nav-hover)] hover:text-foreground hover:duration-0',
            className
        ),
        'data-slot': 'nav-item',
        'data-active': active ? '' : undefined,
        type: typeValue,
    };

    return useRender({
        defaultTagName: 'button',
        props: mergeProps<'button'>(defaultProps, props),
        render,
    });
}

export function NavItemMeta({
    className,
    render,
    ...props
}: useRender.ComponentProps<'div'>): React.ReactElement {
    const defaultProps = {
        className: cn(
            'ml-auto shrink-0 pl-2 text-caption text-muted-foreground tabular-nums',
            className
        ),
        'data-slot': 'nav-item-meta',
    };

    return useRender({
        defaultTagName: 'div',
        props: mergeProps<'div'>(defaultProps, props),
        render,
    });
}

export function NavItemBadge({
    className,
    render,
    ...props
}: useRender.ComponentProps<'div'>): React.ReactElement {
    const defaultProps = {
        className: cn(
            'ml-auto inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-md bg-[var(--nav-hover)] px-1.5 font-medium text-foreground/85 text-micro tabular-nums',
            className
        ),
        'data-slot': 'nav-item-badge',
    };

    return useRender({
        defaultTagName: 'div',
        props: mergeProps<'div'>(defaultProps, props),
        render,
    });
}

export function NavAgent({
    active = false,
    avatar,
    avatarActive = active,
    backgroundColor,
    className,
    collapsed = false,
    label,
    name,
    render,
    ...props
}: Omit<useRender.ComponentProps<'button'>, 'children'> & {
    active?: boolean;
    avatar: string;
    avatarActive?: boolean;
    backgroundColor: string | null;
    collapsed?: boolean;
    label: string;
    name: string;
}): React.ReactElement {
    return (
        <NavItem active={active} className={className} render={render} {...props}>
            <AgentAvatar
                active={avatarActive}
                avatar={avatar}
                backgroundColor={backgroundColor ?? '#64748b'}
                className="size-[18px]"
                name={name}
            />
            <span
                aria-hidden={collapsed}
                className={cn(
                    'min-w-0 flex-1 truncate transition-[max-width,opacity,transform] duration-[180ms] ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none',
                    collapsed
                        ? 'max-w-0 -translate-x-1.5 opacity-0'
                        : 'max-w-32 translate-x-0 opacity-100 delay-[40ms]'
                )}
            >
                {label}
            </span>
        </NavItem>
    );
}
