import type * as React from 'react';
import { cn } from '../../lib/utils.ts';

/**
 * The main content area's bordered topbar: one fixed-height bar with a
 * bottom hairline in the same ink as the sidebar/main seam
 * (`--content-card-border`), so page chrome sits on a line instead of
 * floating. Pages fill it with identity on the left and actions on the
 * right.
 */
export function ContentTopbar({ children, className, ...props }: React.ComponentProps<'header'>) {
    return (
        <header
            className={cn(
                'relative z-40 flex h-[var(--content-topbar-height)] shrink-0 items-center gap-2 border-[var(--content-card-border)] border-b bg-background px-3',
                className
            )}
            data-slot="content-topbar"
            data-window-drag-region=""
            {...props}
        >
            {children}
        </header>
    );
}
