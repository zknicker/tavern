import type { MemoryWorkerStatus } from '@tavern/api';
import { RelativeTime } from '../../../components/time/relative-time.tsx';
import { Badge } from '../../../components/ui/badge.tsx';
import { Separator } from '../../../components/ui/separator.tsx';
import { cn } from '../../../lib/utils.ts';
import {
    formatDuration,
    formatNextRun,
    workerProfiles,
    workerStatusDotClassName,
    workerStatusLabel,
    workerStatusVariant,
} from './background-work-view-data.ts';

export function WorkerTable({ workers }: { workers: MemoryWorkerStatus[] }) {
    const byKind = new Map(workers.map((worker) => [worker.kind, worker]));

    return (
        <div>
            {workerProfiles.map((profile, index) => (
                <div key={profile.kind}>
                    {index > 0 ? <Separator /> : null}
                    <WorkerRow profile={profile} worker={byKind.get(profile.kind) ?? null} />
                </div>
            ))}
        </div>
    );
}

function WorkerRow({
    profile,
    worker,
}: {
    profile: (typeof workerProfiles)[number];
    worker: MemoryWorkerStatus | null;
}) {
    const enabled = worker?.enabled ?? false;

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
            <LastRun worker={worker} />
            <div className="hidden w-32 shrink-0 text-right text-meta text-muted-foreground tabular-nums sm:block">
                {formatNextRun(worker?.nextRun ?? null, enabled)}
            </div>
        </div>
    );
}

function LastRun({ worker }: { worker: MemoryWorkerStatus | null }) {
    const lastRun = worker?.lastRun ?? null;
    if (!worker?.enabled) {
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
                    workerStatusDotClassName(lastRun.status)
                )}
            />
            <span className="truncate text-meta text-muted-foreground tabular-nums">
                <RelativeTime value={when} />
                {duration ? ` · ${duration}` : ''}
            </span>
            {lastRun.status === 'failed' ? (
                <Badge size="sm" variant={workerStatusVariant(lastRun.status)}>
                    {workerStatusLabel(lastRun.status)}
                </Badge>
            ) : null}
        </div>
    );
}
