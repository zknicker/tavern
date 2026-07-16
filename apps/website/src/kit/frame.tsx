import type { ReactNode } from 'react';
import { Elevated } from '../components/ui/surface.tsx';
import { cn } from '../lib/utils.ts';

export function KitFrame({
    children,
    className,
    contentClassName,
    size = 'compact',
    title,
    titleAction,
}: {
    children: ReactNode;
    className?: string;
    contentClassName?: string;
    size?: 'compact' | 'full';
    title?: ReactNode;
    titleAction?: ReactNode;
}) {
    const hasTitle = title !== null && title !== undefined;
    const hasTitleAction = titleAction !== null && titleAction !== undefined;
    const hasHeader = hasTitle || hasTitleAction;

    return (
        <div
            className={cn('w-full', size === 'full' ? 'max-w-[46rem]' : 'max-w-[28rem]', className)}
        >
            {hasHeader ? (
                <div className="mb-1.5 flex min-w-0 flex-wrap items-end justify-between gap-x-3 gap-y-2 px-1 text-muted-foreground">
                    {hasTitle ? (
                        <h3 className="min-w-0 truncate font-medium text-sm leading-5">{title}</h3>
                    ) : (
                        <div className="min-w-0" />
                    )}
                    {hasTitleAction ? (
                        <div className="flex shrink-0 justify-start">{titleAction}</div>
                    ) : null}
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
