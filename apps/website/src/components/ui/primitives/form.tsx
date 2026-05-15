'use client';

import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';
import type React from 'react';
import { cn } from '../../../lib/utils.ts';

export function Form({
    className,
    render,
    ...props
}: useRender.ComponentProps<'form'>): React.ReactElement {
    const defaultProps = {
        className: cn('flex flex-col gap-4', className),
        'data-slot': 'form',
    };

    return useRender({
        defaultTagName: 'form',
        props: mergeProps<'form'>(defaultProps, props),
        render,
    });
}
