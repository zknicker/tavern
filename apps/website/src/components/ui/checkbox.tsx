'use client';

import { Checkbox as CheckboxPrimitive } from '@base-ui/react/checkbox';
import { Tick02Icon } from '@hugeicons-pro/core-stroke-rounded';
import type * as React from 'react';
import { cn } from '../../lib/utils.ts';
import { Icon } from './icon.tsx';

export function Checkbox({
    className,
    ...props
}: CheckboxPrimitive.Root.Props): React.ReactElement {
    return (
        <CheckboxPrimitive.Root
            className={cn(
                'group/checkbox grid size-5 shrink-0 cursor-pointer place-items-center rounded-full border border-border-strong bg-transparent text-brand-foreground outline-none ring-ring/24 transition-[background-color,border-color,box-shadow,transform] duration-150 hover:border-border focus-visible:ring-[3px] active:scale-95 data-disabled:cursor-not-allowed data-checked:border-brand data-checked:bg-brand data-disabled:opacity-64 motion-reduce:transform-none',
                className
            )}
            data-slot="checkbox"
            {...props}
        >
            <CheckboxPrimitive.Indicator>
                <Icon className="size-3.5" icon={Tick02Icon} strokeWidth={3} />
            </CheckboxPrimitive.Indicator>
        </CheckboxPrimitive.Root>
    );
}

export { CheckboxPrimitive };
