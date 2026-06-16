'use client';

import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';
import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';
import { cn } from '../../../lib/utils.ts';
import { Spinner } from '../spinner.tsx';

export const buttonVariants = cva(
    "no-drag relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg border font-medium text-base outline-none transition-shadow before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] pointer-coarse:after:absolute pointer-coarse:after:size-full pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-64 data-loading:select-none data-loading:text-transparent sm:text-sm [&_svg:not([class*='opacity-'])]:opacity-80 [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:-mx-0.5 [&_svg]:shrink-0",
    {
        defaultVariants: {
            size: 'default',
            variant: 'default',
        },
        variants: {
            size: {
                default: 'h-9 px-[calc(--spacing(3)-1px)] sm:h-8',
                icon: 'size-9 sm:size-8',
                'icon-tight':
                    "size-9 rounded-full before:rounded-full sm:size-8 [&_svg:not([class*='size-'])]:size-5 sm:[&_svg:not([class*='size-'])]:size-5",
                'icon-lg': 'size-10 sm:size-9',
                'icon-sm': 'size-8 sm:size-7',
                'icon-xl':
                    "size-11 sm:size-10 [&_svg:not([class*='size-'])]:size-5 sm:[&_svg:not([class*='size-'])]:size-4.5",
                'icon-xs':
                    "size-7 rounded-md before:rounded-[calc(var(--radius-md)-1px)] sm:size-6 not-in-data-[slot=input-group]:[&_svg:not([class*='size-'])]:size-4 sm:not-in-data-[slot=input-group]:[&_svg:not([class*='size-'])]:size-3.5",
                lg: 'h-10 px-[calc(--spacing(3.5)-1px)] sm:h-9',
                sm: 'h-8 gap-1.5 px-[calc(--spacing(2.5)-1px)] sm:h-7',
                xl: "h-11 px-[calc(--spacing(4)-1px)] text-lg sm:h-10 sm:text-base [&_svg:not([class*='size-'])]:size-5 sm:[&_svg:not([class*='size-'])]:size-4.5",
                xs: "h-6 gap-1 rounded-md px-[calc(--spacing(1.5)-1px)] font-normal text-sm before:rounded-[calc(var(--radius-md)-1px)] sm:h-5 sm:text-[0.8125rem] [&_svg:not([class*='size-'])]:size-4 sm:[&_svg:not([class*='size-'])]:size-3.5",
            },
            variant: {
                brand: 'not-disabled:inset-shadow-[0_1px_--theme(--color-white/16%)] border-brand bg-brand text-brand-foreground shadow-brand/24 shadow-xs hover:bg-brand/90 data-pressed:bg-brand/90 *:data-[slot=button-loading-indicator]:text-brand-foreground [:active,[data-pressed]]:inset-shadow-[0_1px_--theme(--color-black/8%)] [:disabled,:active,[data-pressed]]:shadow-none',
                'brand-soft':
                    'border-transparent bg-brand/12 text-brand shadow-none hover:bg-brand/18 disabled:opacity-100 data-pressed:bg-brand/22 *:data-[slot=button-loading-indicator]:text-brand',
                chrome: 'border-border/60 bg-muted/22 text-[var(--sidebar-icon-muted)] hover:border-border/85 hover:bg-muted/44 hover:text-[var(--sidebar-icon-muted)] disabled:border-border/30 disabled:bg-muted/10 disabled:text-[var(--sidebar-icon-muted)] disabled:opacity-100 [&_svg]:opacity-100',
                default:
                    'not-disabled:inset-shadow-[0_1px_--theme(--color-white/16%)] border-primary bg-primary text-primary-foreground shadow-primary/24 shadow-xs hover:bg-primary/90 data-pressed:bg-primary/90 *:data-[slot=button-loading-indicator]:text-primary-foreground [:active,[data-pressed]]:inset-shadow-[0_1px_--theme(--color-black/8%)] [:disabled,:active,[data-pressed]]:shadow-none',
                destructive:
                    'not-disabled:inset-shadow-[0_1px_--theme(--color-white/16%)] border-destructive bg-destructive text-white shadow-destructive/24 shadow-xs hover:bg-destructive/90 data-pressed:bg-destructive/90 *:data-[slot=button-loading-indicator]:text-white [:active,[data-pressed]]:inset-shadow-[0_1px_--theme(--color-black/8%)] [:disabled,:active,[data-pressed]]:shadow-none',
                'destructive-outline':
                    'border-input bg-popover not-dark:bg-clip-padding text-destructive-foreground shadow-xs/5 not-disabled:not-active:not-data-pressed:before:shadow-[0_1px_--theme(--color-black/4%)] hover:border-destructive/32 hover:bg-destructive/4 data-pressed:border-destructive/32 data-pressed:bg-destructive/4 *:data-[slot=button-loading-indicator]:text-foreground dark:bg-input/32 dark:not-disabled:before:shadow-[0_-1px_--theme(--color-white/2%)] dark:not-disabled:not-active:not-data-pressed:before:shadow-[0_-1px_--theme(--color-white/6%)] [:disabled,:active,[data-pressed]]:shadow-none',
                'destructive-ghost':
                    'border-transparent text-destructive-foreground hover:bg-destructive/4 data-pressed:bg-destructive/4 *:data-[slot=button-loading-indicator]:text-foreground',
                'destructive-soft':
                    'border-transparent bg-[color-mix(in_srgb,var(--error-bg),transparent_45%)] text-error-foreground hover:bg-[color-mix(in_srgb,var(--error-bg),transparent_15%)] data-pressed:bg-error-bg *:data-[slot=button-loading-indicator]:text-error-foreground',
                ghost: 'border-transparent text-foreground hover:bg-accent data-pressed:bg-accent *:data-[slot=button-loading-indicator]:text-foreground',
                link: 'border-transparent text-foreground underline-offset-4 hover:underline data-pressed:underline *:data-[slot=button-loading-indicator]:text-foreground',
                outline:
                    'border-input bg-popover not-dark:bg-clip-padding text-foreground shadow-xs/5 not-disabled:not-active:not-data-pressed:before:shadow-[0_1px_--theme(--color-black/4%)] hover:bg-accent/50 data-pressed:bg-accent/50 *:data-[slot=button-loading-indicator]:text-foreground dark:bg-input/32 dark:data-pressed:bg-input/64 dark:hover:bg-input/64 dark:not-disabled:before:shadow-[0_-1px_--theme(--color-white/2%)] dark:not-disabled:not-active:not-data-pressed:before:shadow-[0_-1px_--theme(--color-white/6%)] [:disabled,:active,[data-pressed]]:shadow-none',
                secondary:
                    'border-transparent bg-secondary text-secondary-foreground hover:bg-input data-pressed:bg-input *:data-[slot=button-loading-indicator]:text-secondary-foreground [:active,[data-pressed]]:bg-input',
            },
        },
    }
);

export interface ButtonProps extends useRender.ComponentProps<'button'> {
    loading?: boolean;
    size?: VariantProps<typeof buttonVariants>['size'];
    variant?: VariantProps<typeof buttonVariants>['variant'];
}

export function Button({
    className,
    variant,
    size,
    render,
    children,
    loading = false,
    disabled: disabledProp,
    ...props
}: ButtonProps): React.ReactElement {
    const isDisabled: boolean = Boolean(loading || disabledProp);
    const typeValue: React.ButtonHTMLAttributes<HTMLButtonElement>['type'] = render
        ? undefined
        : 'button';

    const defaultProps = {
        children: (
            <>
                {children}
                {loading && (
                    <Spinner
                        className="pointer-events-none absolute"
                        data-slot="button-loading-indicator"
                    />
                )}
            </>
        ),
        className: cn(buttonVariants({ className, size, variant })),
        'aria-disabled': loading || undefined,
        'data-loading': loading ? '' : undefined,
        'data-slot': 'button',
        disabled: isDisabled,
        type: typeValue,
    };

    return useRender({
        defaultTagName: 'button',
        props: mergeProps<'button'>(defaultProps, props),
        render,
    });
}
