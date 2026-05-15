import { Switch as SwitchPrimitive } from '@base-ui/react/switch';
import type * as React from 'react';
import { cn } from '../../lib/utils.ts';

interface SwitchProps {
    'aria-label'?: string;
    checked?: boolean;
    children?: React.ReactNode;
    className?: string;
    defaultChecked?: boolean;
    disabled?: boolean;
    id?: string;
    name?: string;
    onCheckedChange?: (checked: boolean) => void;
    unstyled?: boolean;
}

function Switch({
    'aria-label': ariaLabel,
    checked,
    children,
    className,
    defaultChecked,
    disabled,
    id,
    name,
    onCheckedChange,
    unstyled = false,
}: SwitchProps) {
    return (
        <SwitchPrimitive.Root
            aria-label={ariaLabel}
            checked={checked}
            className={cn(
                !unstyled &&
                    'group inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-transparent bg-input p-0.5 outline-none ring-ring/24 transition-[background-color,box-shadow,transform] duration-150 ease-out focus-visible:ring-[3px] active:scale-[0.98] data-[disabled]:cursor-not-allowed data-[checked]:bg-brand data-[disabled]:opacity-60 motion-reduce:transform-none motion-reduce:transition-none',
                className
            )}
            defaultChecked={defaultChecked}
            disabled={disabled}
            id={id}
            name={name}
            onCheckedChange={
                onCheckedChange != null ? (value) => onCheckedChange(value) : undefined
            }
        >
            {children ?? (
                <SwitchPrimitive.Thumb className="pointer-events-none block size-4 translate-x-0 transform-gpu rounded-full bg-card transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] will-change-transform group-active:scale-95 group-data-[checked]:translate-x-4 motion-reduce:transition-none dark:bg-foreground" />
            )}
        </SwitchPrimitive.Root>
    );
}

export { Switch };
export type { SwitchProps };
