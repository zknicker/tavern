import type { BadgeProps } from '../../components/ui/badge.tsx';
import { formatTimestamp } from '../../lib/format.ts';
import type { ReminderRunsOutput } from '../../lib/trpc.tsx';
import { cn } from '../../lib/utils.ts';

// Ported from cron-run-view-data.ts. Reminder runs carry a single fire time
// and one of three outcomes (fired / quiet / error) — simpler than cron's
// queued/running/success/skipped/error lifecycle, so the duration and
// scheduled/started/finished split collapse to `firedAt`.
export type ReminderRunRecord = ReminderRunsOutput['runs'][number];

export function formatReminderRunTime(run: ReminderRunRecord) {
    return formatTimestamp(run.firedAt);
}

export function formatReminderRunOutcome(run: ReminderRunRecord): string {
    switch (run.outcome) {
        case 'fired':
            return 'Fired';
        case 'quiet':
            return 'Quiet';
        default:
            return 'Failed';
    }
}

export function getReminderRunDotClassName(run: ReminderRunRecord) {
    return cn(
        run.outcome === 'fired' && 'bg-emerald-500',
        run.outcome === 'quiet' && 'bg-emerald-500/40',
        run.outcome === 'error' && 'bg-red-500'
    );
}

export function getReminderRunStatusVariant(run: ReminderRunRecord): BadgeProps['variant'] {
    switch (run.outcome) {
        case 'error':
            return 'destructive';
        case 'fired':
            return 'success';
        default:
            return 'secondary';
    }
}

// The one-line detail beneath a run: the error for a failure, otherwise the
// script output preview that rode the fire.
export function formatReminderRunDetail(run: ReminderRunRecord): string | null {
    if (run.outcome === 'error') {
        return run.errorMessage?.trim() || 'Reminder script failed.';
    }
    const output = run.output?.trim();
    return output ? output.split('\n')[0] : null;
}
