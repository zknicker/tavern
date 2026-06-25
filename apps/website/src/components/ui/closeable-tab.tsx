import type * as React from 'react';
import { cn } from '../../lib/utils.ts';

export function CloseableTab({
    children,
    className,
    closeable = true,
    closeLabel,
    closeSide = 'right',
    onClose,
}: {
    children: React.ReactNode;
    className?: string;
    closeable?: boolean;
    closeLabel: string;
    closeSide?: 'left' | 'right';
    onClose: () => void;
}) {
    return (
        <div className={cn('group/tab relative', className)}>
            {children}
            {closeable ? (
                <button
                    aria-label={closeLabel}
                    className={cn(
                        'no-drag absolute top-1/2 z-20 flex size-3.5 -translate-y-1/2 items-center justify-center rounded-full bg-muted-foreground/62 text-background opacity-0 transition-[background-color,opacity] hover:bg-foreground focus-visible:bg-foreground focus-visible:opacity-100 group-hover/tab:opacity-100',
                        closeSide === 'left' ? 'left-1.5' : 'right-1.5'
                    )}
                    onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        onClose();
                    }}
                    onPointerDown={(event) => {
                        event.stopPropagation();
                    }}
                    tabIndex={-1}
                    title={closeLabel}
                    type="button"
                >
                    <CodexCloseGlyph />
                </button>
            ) : null}
        </div>
    );
}

function CodexCloseGlyph() {
    return (
        <svg
            aria-hidden="true"
            className="size-2.5"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2.75"
            viewBox="0 0 12 12"
        >
            <path d="M3.25 3.25 8.75 8.75M8.75 3.25 3.25 8.75" />
        </svg>
    );
}
