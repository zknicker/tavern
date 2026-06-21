import type { ReactNode } from 'react';
import { cn } from '../../lib/utils.ts';
import { Elevated } from '../ui/surface.tsx';

export function RichResponseFrame({
    children,
    className,
    contentClassName,
    size = 'compact',
    title,
}: {
    children: ReactNode;
    className?: string;
    contentClassName?: string;
    size?: 'compact' | 'full';
    title?: ReactNode;
}) {
    const hasHeader = title !== null && title !== undefined;

    return (
        <div
            className={cn('w-full', size === 'full' ? 'max-w-[46rem]' : 'max-w-[28rem]', className)}
        >
            {hasHeader ? (
                <div className="mb-1.5 min-w-0 px-1 text-muted-foreground">
                    <h3 className="min-w-0 truncate font-medium text-sm leading-5">{title}</h3>
                </div>
            ) : null}
            <Elevated
                className={cn(
                    'relative min-w-0 overflow-visible rounded-2xl px-3 pt-3 pb-3',
                    contentClassName
                )}
                offset={1}
            >
                {children}
            </Elevated>
        </div>
    );
}
