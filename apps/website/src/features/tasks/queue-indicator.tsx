import { TaskActivityIndicator } from './task-activity-indicator.tsx';
import type { DispatchQueueSummary } from './task-presentation.ts';

// Compact live pulse for the toolbar: how many dispatched turns are running and
// how many eligible tasks are queued behind them. Only rendered while
// auto-dispatch is enabled and healthy, so its presence itself signals a live
// board.
export function TaskQueueIndicator({ queued, running }: DispatchQueueSummary) {
    return (
        <div
            className="hidden shrink-0 items-center gap-1.5 rounded-full bg-muted/40 px-2.5 py-1 text-muted-foreground text-xs sm:flex"
            title={`${running} running, ${queued} queued`}
        >
            {running > 0 ? (
                <TaskActivityIndicator label={`${running} running`} />
            ) : (
                <span className="size-2 shrink-0 rounded-full bg-muted-foreground/40" />
            )}
            <span>
                <span className="font-medium text-foreground tabular-nums">{running}</span> running
            </span>
            <span aria-hidden="true" className="text-muted-foreground/40">
                &middot;
            </span>
            <span>
                <span className="font-medium text-foreground tabular-nums">{queued}</span> queued
            </span>
        </div>
    );
}
