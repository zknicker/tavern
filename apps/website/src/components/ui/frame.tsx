'use client';

import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';
import type React from 'react';
import { cn } from '../../lib/utils.ts';

export function Frame({
    className,
    render,
    ...props
}: useRender.ComponentProps<'div'>): React.ReactElement {
    const defaultProps = {
        className: cn(
            'relative flex flex-col gap-0.5 rounded-xl bg-frame not-dark:bg-clip-padding p-1.5',
            className
        ),
        'data-slot': 'frame',
    };

    return useRender({
        defaultTagName: 'div',
        props: mergeProps<'div'>(defaultProps, props),
        render,
    });
}

export function FrameHeader({
    className,
    render,
    ...props
}: useRender.ComponentProps<'div'>): React.ReactElement {
    const defaultProps = {
        className: cn('flex flex-col gap-0.5 px-2.5 pt-1.5 pb-0.5', className),
        'data-slot': 'frame-header',
    };

    return useRender({
        defaultTagName: 'div',
        props: mergeProps<'div'>(defaultProps, props),
        render,
    });
}

export function FrameTitle({
    className,
    render,
    ...props
}: useRender.ComponentProps<'div'>): React.ReactElement {
    const defaultProps = {
        className: cn('font-medium text-foreground text-sm leading-none', className),
        'data-slot': 'frame-title',
    };

    return useRender({
        defaultTagName: 'div',
        props: mergeProps<'div'>(defaultProps, props),
        render,
    });
}

export function FrameDescription({
    className,
    render,
    ...props
}: useRender.ComponentProps<'div'>): React.ReactElement {
    const defaultProps = {
        className: cn('text-muted-foreground text-sm leading-normal', className),
        'data-slot': 'frame-description',
    };

    return useRender({
        defaultTagName: 'div',
        props: mergeProps<'div'>(defaultProps, props),
        render,
    });
}

export function FrameContent({
    className,
    render,
    ...props
}: useRender.ComponentProps<'div'>): React.ReactElement {
    const defaultProps = {
        className: cn('flex flex-col gap-3', className),
        'data-slot': 'frame-content',
    };

    return useRender({
        defaultTagName: 'div',
        props: mergeProps<'div'>(defaultProps, props),
        render,
    });
}

export function FramePanel({
    className,
    render,
    ...props
}: useRender.ComponentProps<'div'>): React.ReactElement {
    const defaultProps = {
        className: cn(
            'relative flex flex-col overflow-hidden rounded-lg border bg-card not-dark:bg-clip-padding text-card-foreground *:data-[slot=card]:-m-px *:data-[slot=card]:rounded-none *:data-[slot=card]:border-x-0 *:data-[slot=card]:bg-clip-padding *:data-[slot=card]:shadow-none *:last:data-[slot=card]:border-b-0 *:first:data-[slot=card]:border-t-0 *:data-[slot=card]:before:hidden dark:shadow-xs/5 dark:before:pointer-events-none dark:before:absolute dark:before:inset-0 dark:before:rounded-[calc(var(--radius-lg,0.5rem)-1px)] dark:before:shadow-[0_-1px_--theme(--color-white/6%)]',
            className
        ),
        'data-slot': 'frame-panel',
    };

    return useRender({
        defaultTagName: 'div',
        props: mergeProps<'div'>(defaultProps, props),
        render,
    });
}

export function FrameFooter({
    className,
    render,
    ...props
}: useRender.ComponentProps<'div'>): React.ReactElement {
    const defaultProps = {
        className: cn('flex items-center justify-between gap-3 px-2.5 pt-0.5 pb-1.5', className),
        'data-slot': 'frame-footer',
    };

    return useRender({
        defaultTagName: 'div',
        props: mergeProps<'div'>(defaultProps, props),
        render,
    });
}
