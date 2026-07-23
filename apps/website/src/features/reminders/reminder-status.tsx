import { CheckmarkCircle02Icon, Clock, XCircle } from '@hugeicons/core-free-icons';
import { Badge } from '../../components/ui/badge.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import type { ReminderListItem } from './reminder-list-data.ts';

// Ported from cron-job-status.tsx. Reminder status replaces the cron
// enabled/paused axis; the last-outcome badge replaces the success-rate one.
const outcomeIcons = {
    error: <Icon className="size-3.5 text-error" icon={XCircle} />,
    fired: <Icon className="size-3.5 text-success" icon={CheckmarkCircle02Icon} />,
    quiet: <Icon className="size-3.5 text-success" icon={CheckmarkCircle02Icon} />,
    unknown: <Icon className="size-3.5 text-muted-foreground" icon={Clock} />,
} as const;

function statusVariant(
    status: ReminderListItem['status']
): 'success' | 'destructive' | 'warning' | 'secondary' {
    switch (status) {
        case 'scheduled':
            return 'warning';
        case 'fired':
            return 'success';
        default:
            return 'secondary';
    }
}

function outcomeVariant(
    outcome: ReminderListItem['lastOutcome']
): 'success' | 'destructive' | 'secondary' {
    switch (outcome) {
        case 'error':
            return 'destructive';
        case 'fired':
        case 'quiet':
            return 'success';
        default:
            return 'secondary';
    }
}

export function ReminderStateBadge({ reminder }: { reminder: ReminderListItem }) {
    const label =
        reminder.status === 'scheduled'
            ? 'Scheduled'
            : reminder.status === 'fired'
              ? 'Fired'
              : 'Canceled';
    return <Badge variant={statusVariant(reminder.status)}>{label}</Badge>;
}

export function ReminderLastRun({ reminder }: { reminder: ReminderListItem }) {
    if (reminder.lastRun === 'unknown') {
        return <span className="text-muted-foreground text-sm">—</span>;
    }

    return (
        <span className="flex shrink-0 items-center gap-1.5 text-muted-foreground text-sm">
            {outcomeIcons[reminder.lastOutcome === 'unknown' ? 'unknown' : reminder.lastOutcome]}
            <span>{reminder.lastRun}</span>
        </span>
    );
}

export function ReminderResultBadge({ reminder }: { reminder: ReminderListItem }) {
    if (reminder.lastOutcome === 'unknown') {
        return <span className="text-muted-foreground text-sm">—</span>;
    }

    const label =
        reminder.lastOutcome === 'error'
            ? 'Failed'
            : reminder.lastOutcome === 'quiet'
              ? 'Quiet'
              : 'Fired';
    return (
        <Badge
            title={reminder.lastErrorMessage ?? undefined}
            variant={outcomeVariant(reminder.lastOutcome)}
        >
            {label}
        </Badge>
    );
}

export function ReminderStatus({ reminder }: { reminder: ReminderListItem }) {
    return (
        <>
            <ReminderStateBadge reminder={reminder} />
            <span className="hidden sm:flex">
                <ReminderLastRun reminder={reminder} />
            </span>
            <ReminderResultBadge reminder={reminder} />
        </>
    );
}
