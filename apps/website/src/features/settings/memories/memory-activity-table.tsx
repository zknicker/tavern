import type { MemoryActivity } from '@tavern/api';
import { RelativeTime } from '../../../components/time/relative-time.tsx';
import { Badge } from '../../../components/ui/badge.tsx';
import { Separator } from '../../../components/ui/separator.tsx';
import { cn } from '../../../lib/utils.ts';
import {
    activityProfiles,
    formatDuration,
    formatNextRun,
    runStatusDotClassName,
    runStatusLabel,
    runStatusVariant,
} from './background-work-view-data.ts';

export function MemoryActivityTable({ activities }: { activities: MemoryActivity[] }) {
    const byKind = new Map(activities.map((activity) => [activity.kind, activity]));

    return (
        <div>
            {activityProfiles.map((profile, index) => (
                <div key={profile.kind}>
                    {index > 0 ? <Separator /> : null}
                    <ActivityRow activity={byKind.get(profile.kind) ?? null} profile={profile} />
                </div>
            ))}
        </div>
    );
}

function ActivityRow({
    activity,
    profile,
}: {
    activity: MemoryActivity | null;
    profile: (typeof activityProfiles)[number];
}) {
    const enabled = activity?.enabled ?? false;

    return (
        <div
            className={cn(
                'flex items-start gap-4 px-4 py-3.5 sm:items-center',
                !enabled && 'opacity-72'
            )}
        >
            <div className="min-w-0 flex-1">
                <p className="font-medium text-sm">{profile.name}</p>
                <p className="truncate text-meta text-muted-foreground">{profile.purpose}</p>
            </div>
            <LastRun activity={activity} />
            <div className="hidden w-32 shrink-0 text-right text-meta text-muted-foreground tabular-nums sm:block">
                {formatNextRun(activity?.nextRun ?? null, enabled)}
            </div>
        </div>
    );
}

function LastRun({ activity }: { activity: MemoryActivity | null }) {
    const lastRun = activity?.lastRun ?? null;
    if (!activity?.enabled) {
        return (
            <span className="w-40 shrink-0 text-right text-meta text-muted-foreground">Off</span>
        );
    }
    if (!lastRun) {
        return (
            <span className="w-40 shrink-0 text-right text-meta text-muted-foreground">
                No runs yet
            </span>
        );
    }

    const duration = formatDuration(lastRun.durationMs);
    const when = lastRun.completedAt ?? lastRun.startedAt;

    return (
        <div className="flex w-40 shrink-0 items-center justify-end gap-2">
            <span
                aria-hidden
                className={cn(
                    'size-1.5 shrink-0 rounded-full',
                    runStatusDotClassName(lastRun.status)
                )}
            />
            <span className="truncate text-meta text-muted-foreground tabular-nums">
                <RelativeTime value={when} />
                {duration ? ` · ${duration}` : ''}
            </span>
            {lastRun.status === 'failed' ? (
                <Badge size="sm" variant={runStatusVariant(lastRun.status)}>
                    {runStatusLabel(lastRun.status)}
                </Badge>
            ) : null}
        </div>
    );
}
