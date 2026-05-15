'use client';

import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';
import type React from 'react';
import { cn } from '../../../lib/utils.ts';

export function Field({
    className,
    render,
    ...props
}: useRender.ComponentProps<'div'>): React.ReactElement {
    const defaultProps = {
        className: cn('flex flex-col gap-1.5', className),
        'data-slot': 'field',
    };

    return useRender({
        defaultTagName: 'div',
        props: mergeProps<'div'>(defaultProps, props),
        render,
    });
}

export function FieldLabel({
    className,
    render,
    ...props
}: useRender.ComponentProps<'label'>): React.ReactElement {
    const defaultProps = {
        className: cn('inline-flex items-center gap-2 text-foreground text-sm', className),
        'data-slot': 'field-label',
    };

    return useRender({
        defaultTagName: 'label',
        props: mergeProps<'label'>(defaultProps, props),
        render,
    });
}

export function FieldDescription({
    className,
    render,
    ...props
}: useRender.ComponentProps<'p'>): React.ReactElement {
    const defaultProps = {
        className: cn('text-muted-foreground text-xs leading-relaxed', className),
        'data-slot': 'field-description',
    };

    return useRender({
        defaultTagName: 'p',
        props: mergeProps<'p'>(defaultProps, props),
        render,
    });
}

export function FieldError({
    className,
    render,
    ...props
}: useRender.ComponentProps<'p'>): React.ReactElement {
    const defaultProps = {
        className: cn('text-red-400 text-xs leading-relaxed', className),
        'data-slot': 'field-error',
    };

    return useRender({
        defaultTagName: 'p',
        props: mergeProps<'p'>(defaultProps, props),
        render,
    });
}
