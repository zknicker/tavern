import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';
import type React from 'react';
import { cn } from '../../lib/utils.ts';

export function Section({
    className,
    render,
    ...props
}: useRender.ComponentProps<'section'>): React.ReactElement {
    const defaultProps = {
        className: cn('flex flex-col gap-6', className),
        'data-slot': 'section',
    };

    return useRender({
        defaultTagName: 'section',
        props: mergeProps<'section'>(defaultProps, props),
        render,
    });
}

export function SectionHeader({
    className,
    render,
    ...props
}: useRender.ComponentProps<'div'>): React.ReactElement {
    const defaultProps = {
        className: cn('flex flex-col gap-1.5', className),
        'data-slot': 'section-header',
    };

    return useRender({
        defaultTagName: 'div',
        props: mergeProps<'div'>(defaultProps, props),
        render,
    });
}

export function SectionTitle({
    className,
    render,
    ...props
}: useRender.ComponentProps<'h2'>): React.ReactElement {
    const defaultProps = {
        className: cn('font-semibold text-foreground text-xl tracking-tight', className),
        'data-slot': 'section-title',
    };

    return useRender({
        defaultTagName: 'h2',
        props: mergeProps<'h2'>(defaultProps, props),
        render,
    });
}

export function SectionDescription({
    className,
    render,
    ...props
}: useRender.ComponentProps<'p'>): React.ReactElement {
    const defaultProps = {
        className: cn('max-w-2xl text-base text-muted-foreground leading-relaxed', className),
        'data-slot': 'section-description',
    };

    return useRender({
        defaultTagName: 'p',
        props: mergeProps<'p'>(defaultProps, props),
        render,
    });
}

export function SectionContent({
    className,
    render,
    ...props
}: useRender.ComponentProps<'div'>): React.ReactElement {
    const defaultProps = {
        className: cn(className),
        'data-slot': 'section-content',
    };

    return useRender({
        defaultTagName: 'div',
        props: mergeProps<'div'>(defaultProps, props),
        render,
    });
}
