import type { ReactNode } from 'react';
import { cn } from '../../lib/utils.ts';
import { Elevated } from '../ui/surface.tsx';

export function WidgetFrame({
    action,
    children,
    className,
    contentClassName,
    expanded = false,
    title,
}: {
    action?: ReactNode;
    children: ReactNode;
    className?: string;
    contentClassName?: string;
    expanded?: boolean;
    title: ReactNode;
}) {
    return (
        <div className={cn('w-full', expanded ? 'max-w-[46rem]' : 'max-w-[28rem]', className)}>
            <div className="mb-1.5 flex min-w-0 items-center justify-between gap-2 px-1 text-muted-foreground">
                <h3 className="min-w-0 truncate font-medium text-sm leading-5">{title}</h3>
                {action}
            </div>
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
