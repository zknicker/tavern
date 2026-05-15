'use client';

import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';
import type React from 'react';
import { cn } from '../../../lib/utils.ts';

export function Fieldset({
    className,
    render,
    ...props
}: useRender.ComponentProps<'fieldset'>): React.ReactElement {
    const defaultProps = {
        className: cn('grid gap-4', className),
        'data-slot': 'fieldset',
    };

    return useRender({
        defaultTagName: 'fieldset',
        props: mergeProps<'fieldset'>(defaultProps, props),
        render,
    });
}

export function FieldsetLegend({
    className,
    render,
    ...props
}: useRender.ComponentProps<'legend'>): React.ReactElement {
    const defaultProps = {
        className: cn('font-semibold text-foreground text-sm leading-none', className),
        'data-slot': 'fieldset-legend',
    };

    return useRender({
        defaultTagName: 'legend',
        props: mergeProps<'legend'>(defaultProps, props),
        render,
    });
}

export function FieldsetDescription({
    className,
    render,
    ...props
}: useRender.ComponentProps<'p'>): React.ReactElement {
    const defaultProps = {
        className: cn('text-muted-foreground text-sm leading-relaxed', className),
        'data-slot': 'fieldset-description',
    };

    return useRender({
        defaultTagName: 'p',
        props: mergeProps<'p'>(defaultProps, props),
        render,
    });
}
