import { Badge, type BadgeProps } from '../../../components/ui/badge.tsx';
import type { RunEvent } from './columns.tsx';

const stateStyles: Record<string, { badgeVariant: BadgeProps['variant'] }> = {
    active: { badgeVariant: 'info' },
    completed: { badgeVariant: 'success' },
    delayed: { badgeVariant: 'secondary' },
    failed: { badgeVariant: 'destructive' },
    unknown: { badgeVariant: 'secondary' },
    waiting: { badgeVariant: 'warning' },
};

function formatDuration(ms: number | null) {
    if (ms === null) {
        return '—';
    }

    if (ms < 1000) {
        return `${ms}ms`;
    }

    if (ms < 60_000) {
        return `${(ms / 1000).toFixed(1)}s`;
    }

    return `${(ms / 60_000).toFixed(1)}m`;
}

function formatLogTime(date: Date | string) {
    const d = date instanceof Date ? date : new Date(date);
    const month = d.toLocaleDateString('en-US', { month: 'short' });
    const day = d.getDate().toString().padStart(2, '0');
    const time = d.toLocaleTimeString('en-US', {
        hour: '2-digit',
        hour12: false,
        minute: '2-digit',
    });

    return `${month} ${day}, ${time}`;
}

function formatLogTimeTitle(date: Date | string) {
    const d = date instanceof Date ? date : new Date(date);

    return d.toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'medium',
    });
}

export function JobEventTimeCell({ row }: { row: { original: RunEvent } }) {
    return (
        <span
            className="whitespace-nowrap font-mono text-meta text-muted-foreground tabular-nums"
            title={formatLogTimeTitle(row.original.createdAt)}
        >
            {formatLogTime(row.original.createdAt)}
        </span>
    );
}

export function JobEventStatusCell({ row }: { row: { original: RunEvent } }) {
    const state = row.original.state;
    const styles = stateStyles[state] ?? stateStyles.unknown;

    return (
        <Badge size="sm" variant={styles.badgeVariant}>
            {state}
        </Badge>
    );
}

export function JobEventNameCell({ row }: { row: { original: RunEvent } }) {
    return <span className="truncate text-foreground text-sm">{row.original.jobDisplayName}</span>;
}

export function JobEventErrorCell({ row }: { row: { original: RunEvent } }) {
    const error = row.original.error;

    if (!error) {
        return <span className="text-meta text-muted-foreground/60">—</span>;
    }

    return (
        <span className="line-clamp-1 text-destructive text-meta" title={error}>
            {error}
        </span>
    );
}

export function JobEventDurationCell({ row }: { row: { original: RunEvent } }) {
    return (
        <span className="font-mono text-meta text-muted-foreground tabular-nums">
            {formatDuration(row.original.durationMs)}
        </span>
    );
}
