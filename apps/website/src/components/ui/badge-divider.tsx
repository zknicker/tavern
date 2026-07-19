import type React from 'react';
import { cn } from '../../lib/utils.ts';
import { Badge, type BadgeProps } from './badge.tsx';
import { Separator } from './separator.tsx';

interface BadgeDividerProps extends Omit<React.ComponentProps<'div'>, 'children'> {
    action?: React.ReactNode;
    badgeLocation?: 'center' | 'left' | 'right';
    children: React.ReactNode;
    labelClassName?: string;
    separatorClassName?: string;
    subtext?: React.ReactNode;
    subtextClassName?: string;
    variant?: BadgeProps['variant'];
}

/**
 * Section divider anchored by a real Badge chip — brand-tinted by default so
 * structure markers keep Tavern's voice — on a whisper-quiet hairline. The
 * chip inherits the badge system (mono, uppercase, bordered, rounded-sm);
 * pass `variant` for semantic sections.
 */
export function BadgeDivider({
    action,
    badgeLocation = 'left',
    children,
    className,
    labelClassName,
    separatorClassName,
    subtext,
    subtextClassName,
    variant = 'brand',
    ...props
}: BadgeDividerProps) {
    const label = (
        <Badge className={cn('shrink-0', labelClassName)} variant={variant}>
            {children}
        </Badge>
    );
    const inlineSubtext = subtext ? (
        <span
            className={cn('max-w-[32ch] truncate text-muted-foreground text-sm', subtextClassName)}
        >
            {subtext}
        </span>
    ) : null;
    const separator = (position: 'end' | 'start') => (
        <Separator
            className={cn('min-w-6 flex-1 bg-border/40', separatorClassName)}
            key={position}
        />
    );

    return (
        <div className={cn('flex min-w-0 items-center gap-3', className)} {...props}>
            {badgeLocation === 'left' ? (
                <>
                    {label}
                    {inlineSubtext}
                    {separator('end')}
                    {action}
                </>
            ) : badgeLocation === 'center' ? (
                <>
                    {separator('start')}
                    {label}
                    {inlineSubtext}
                    {separator('end')}
                    {action}
                </>
            ) : (
                <>
                    {action}
                    {separator('start')}
                    {inlineSubtext}
                    {label}
                </>
            )}
        </div>
    );
}
