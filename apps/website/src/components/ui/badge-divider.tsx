import type React from 'react';
import { cn } from '../../lib/utils.ts';
import { Separator } from './separator.tsx';

interface BadgeDividerProps extends Omit<React.ComponentProps<'div'>, 'children'> {
    action?: React.ReactNode;
    badgeLocation?: 'left' | 'right';
    children: React.ReactNode;
    labelClassName?: string;
    separatorClassName?: string;
    subtext?: React.ReactNode;
    subtextClassName?: string;
}

export function BadgeDivider({
    action,
    badgeLocation = 'left',
    children,
    className,
    labelClassName,
    separatorClassName,
    subtext,
    subtextClassName,
    ...props
}: BadgeDividerProps) {
    const label = (
        <span
            className={cn(
                'inline-flex shrink-0 items-center gap-2 rounded-full bg-brand-muted px-3 py-0.5 font-medium text-brand text-sm',
                labelClassName
            )}
        >
            {children}
        </span>
    );
    const inlineSubtext = subtext ? (
        <span
            className={cn('max-w-[32ch] truncate text-muted-foreground text-sm', subtextClassName)}
        >
            {subtext}
        </span>
    ) : null;
    const separator = <Separator className={cn('min-w-6 flex-1', separatorClassName)} />;

    return (
        <div className={cn('flex min-w-0 items-center gap-3', className)} {...props}>
            {badgeLocation === 'left' ? (
                <>
                    {label}
                    {inlineSubtext}
                    {separator}
                    {action}
                </>
            ) : (
                <>
                    {action}
                    {separator}
                    {inlineSubtext}
                    {label}
                </>
            )}
        </div>
    );
}
