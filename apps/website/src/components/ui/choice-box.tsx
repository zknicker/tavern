'use client';

import { Radio as RadioPrimitive } from '@base-ui/react/radio';
import { RadioGroup as RadioGroupPrimitive } from '@base-ui/react/radio-group';
import { Tick02Icon } from '@hugeicons-pro/core-stroke-rounded';
import type * as React from 'react';
import { cn } from '../../lib/utils.ts';
import { Icon } from './icon.tsx';

export function ChoiceBoxGroup({
    className,
    ...props
}: RadioGroupPrimitive.Props): React.ReactElement {
    return (
        <RadioGroupPrimitive
            className={cn('grid grid-cols-1 gap-2 sm:grid-cols-2', className)}
            data-slot="choice-box-group"
            {...props}
        />
    );
}

export function ChoiceBox({
    children,
    className,
    description,
    title,
    ...props
}: RadioPrimitive.Root.Props & {
    description?: React.ReactNode;
    title: React.ReactNode;
}): React.ReactElement {
    return (
        <RadioPrimitive.Root
            className={cn(
                'relative flex min-h-11 w-full cursor-pointer select-none flex-col rounded-lg border border-border/70 bg-transparent py-1.5 ps-3 pe-10 text-left text-foreground outline-none ring-ring/24 transition-[background-color,border-color,box-shadow] hover:border-border hover:bg-muted/45 focus-visible:border-ring focus-visible:ring-[3px] data-disabled:pointer-events-none data-checked:border-transparent data-checked:bg-muted data-disabled:opacity-64 dark:border-border/55 dark:bg-transparent dark:data-checked:bg-input/32 dark:hover:border-border/75 dark:hover:bg-input/24',
                className
            )}
            data-slot="choice-box"
            {...props}
        >
            <span className="truncate font-medium text-sm">{title}</span>
            {description ? (
                <span className="truncate text-muted-foreground text-sm">{description}</span>
            ) : null}
            <span
                aria-hidden="true"
                className="absolute top-1/2 right-3 grid size-5 -translate-y-1/2 place-items-center rounded-full border border-border-strong bg-transparent"
            />
            <RadioPrimitive.Indicator className="absolute top-1/2 right-3 grid size-5 -translate-y-1/2 place-items-center rounded-full bg-brand text-brand-foreground">
                <Icon className="size-3" icon={Tick02Icon} strokeWidth={3} />
            </RadioPrimitive.Indicator>
            {children}
        </RadioPrimitive.Root>
    );
}

export { RadioGroupPrimitive as ChoiceBoxGroupPrimitive, RadioPrimitive as ChoiceBoxPrimitive };
