'use client';

import type * as React from 'react';
import { cn } from '../../lib/utils.ts';
import { Card } from './card.tsx';

type CardStackProps = React.ComponentProps<typeof Card>;

interface CardStackItemProps
    extends Omit<React.ComponentProps<'div'>, 'children' | 'onClick' | 'onKeyDown'> {
    actions?: React.ReactNode;
    children: React.ReactNode;
    onOpen?: () => void;
    openLabel?: string;
}

export function CardStack({ className, ...props }: CardStackProps): React.ReactElement {
    return <Card className={cn('overflow-hidden p-0', className)} {...props} />;
}

export function CardStackItem({
    actions,
    children,
    className,
    onOpen,
    openLabel = 'Open',
    ...props
}: CardStackItemProps): React.ReactElement {
    const interactive = Boolean(onOpen);
    const itemClassName = cn(
        'relative flex items-center gap-3 border-border/70 border-t px-3 py-3 first:border-t-0 md:px-4 md:py-4',
        interactive && 'hover:bg-muted has-focus-visible:bg-muted',
        className
    );

    return (
        <div className={itemClassName} {...props}>
            {onOpen ? (
                <button
                    aria-label={openLabel}
                    className="absolute inset-0 z-10 cursor-pointer rounded-[inherit] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/24"
                    onClick={onOpen}
                    type="button"
                />
            ) : null}

            <div
                className={cn(
                    'relative z-20 flex min-w-0 flex-1 items-center gap-3',
                    onOpen && 'pointer-events-none'
                )}
            >
                {children}
            </div>

            {actions ? (
                <div className="relative z-20 flex shrink-0 items-center">{actions}</div>
            ) : null}
        </div>
    );
}
