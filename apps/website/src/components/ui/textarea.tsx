'use client';

import { Field as FieldPrimitive } from '@base-ui/react/field';
import { mergeProps } from '@base-ui/react/merge-props';
import type * as React from 'react';
import { cn } from '../../lib/utils.ts';

export type TextareaProps = React.ComponentPropsWithoutRef<'textarea'> &
    React.RefAttributes<HTMLElement> & {
        size?: 'sm' | 'default' | 'lg' | number;
        textareaClassName?: string;
        unstyled?: boolean;
    };

export function Textarea({
    className,
    size = 'default',
    textareaClassName,
    unstyled = false,
    ref,
    ...props
}: TextareaProps): React.ReactElement {
    return (
        <span
            className={
                cn(
                    !unstyled &&
                        'relative inline-flex w-full cursor-text rounded-lg border border-input bg-background not-dark:bg-clip-padding text-foreground shadow-xs/5 ring-ring/24 transition-shadow before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] has-focus-visible:has-aria-invalid:border-destructive/64 has-focus-visible:has-aria-invalid:ring-destructive/16 has-aria-invalid:border-destructive/36 has-focus-visible:border-ring has-disabled:opacity-64 has-[:disabled,:focus-visible,[aria-invalid]]:shadow-none has-focus-visible:ring-[3px] dark:bg-input/32 dark:has-aria-invalid:ring-destructive/24 dark:not-has-disabled:has-not-focus-visible:not-has-aria-invalid:before:shadow-[0_-1px_--theme(--color-white/6%)]',
                    !unstyled && size === 'sm' && 'text-sm',
                    !unstyled && size !== 'sm' && 'text-sm',
                    className
                ) || undefined
            }
            data-size={size}
            data-slot="textarea-control"
        >
            <FieldPrimitive.Control
                defaultValue={props.defaultValue}
                disabled={props.disabled}
                id={props.id}
                name={props.name}
                ref={ref}
                render={(defaultProps: React.ComponentProps<'textarea'>) => (
                    <textarea
                        className={cn(
                            'field-sizing-content min-h-20 w-full cursor-text rounded-[inherit] px-3 py-2 outline-none',
                            size === 'sm' && 'min-h-16 px-2.5 py-1.5 text-sm',
                            size === 'default' && 'text-sm',
                            size === 'lg' && 'min-h-24 py-3 text-sm',
                            textareaClassName
                        )}
                        data-slot="textarea"
                        {...mergeProps(defaultProps, props)}
                    />
                )}
                value={props.value}
            />
        </span>
    );
}

export { FieldPrimitive };
