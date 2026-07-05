import type { MemoryJobSummary } from '@tavern/api';
import { Tooltip } from '../../../components/ui/tooltip.tsx';
import { formatTimestamp } from '../../../lib/format.ts';
import { cn } from '../../../lib/utils.ts';
import {
    buildTimelineLanes,
    formatDuration,
    type TimelineLane,
    timelineTime,
    workerName,
    workerStatusDotClassName,
    workerStatusLabel,
} from './background-work-view-data.ts';

const windowDays = 14;
const windowMs = windowDays * 24 * 60 * 60 * 1000;

export function WorkerTimeline({
    jobs,
    onSelectRun,
}: {
    jobs: MemoryJobSummary[];
    onSelectRun: (jobId: string) => void;
}) {
    const now = Date.now();
    const windowStart = now - windowMs;
    const lanes = buildTimelineLanes(jobs);
    const hasRuns = jobs.length > 0;

    if (!hasRuns) {
        return (
            <p className="px-4 py-8 text-center text-muted-foreground text-sm">
                No background runs in the last {windowDays} days.
            </p>
        );
    }

    return (
        <div className="px-4 py-4">
            <div className="space-y-2.5">
                {lanes.map((lane) => (
                    <Lane
                        key={lane.kind}
                        lane={lane}
                        now={now}
                        onSelectRun={onSelectRun}
                        windowStart={windowStart}
                    />
                ))}
            </div>
            <AxisLabels now={now} windowStart={windowStart} />
        </div>
    );
}

function Lane({
    lane,
    now,
    onSelectRun,
    windowStart,
}: {
    lane: TimelineLane;
    now: number;
    onSelectRun: (jobId: string) => void;
    windowStart: number;
}) {
    return (
        <div className="flex items-center gap-3">
            <span className="w-24 shrink-0 truncate text-meta text-muted-foreground">
                {lane.name}
            </span>
            <div className="relative h-6 flex-1 rounded-md bg-muted/40">
                <span
                    aria-hidden
                    className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border/70"
                />
                {lane.runs.map((run) => (
                    <RunDot
                        key={run.id}
                        now={now}
                        onSelectRun={onSelectRun}
                        run={run}
                        windowStart={windowStart}
                    />
                ))}
            </div>
        </div>
    );
}

function RunDot({
    now,
    onSelectRun,
    run,
    windowStart,
}: {
    now: number;
    onSelectRun: (jobId: string) => void;
    run: MemoryJobSummary;
    windowStart: number;
}) {
    const at = timelineTime(run);
    const clamped = Math.min(Math.max(at, windowStart), now);
    const left = ((clamped - windowStart) / (now - windowStart)) * 100;
    const duration = formatDuration(run.status === 'running' ? null : durationOf(run));

    return (
        <Tooltip
            content={
                <span className="block text-meta">
                    <span className="font-medium">{workerName(run.kind)}</span>
                    {' · '}
                    {workerStatusLabel(run.status)}
                    {' · '}
                    {formatTimestamp(run.completedAt ?? run.createdAt)}
                    {duration ? ` · ${duration}` : ''}
                </span>
            }
            side="top"
        >
            <button
                aria-label={`${workerName(run.kind)} run, ${workerStatusLabel(run.status)}`}
                className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                onClick={() => onSelectRun(run.id)}
                style={{ left: `${left}%` }}
                type="button"
            >
                <span
                    className={cn(
                        'block size-2.5 rounded-full ring-2 ring-background transition-transform hover:scale-125',
                        workerStatusDotClassName(run.status)
                    )}
                />
            </button>
        </Tooltip>
    );
}

function AxisLabels({ windowStart }: { now: number; windowStart: number }) {
    return (
        <div className="mt-2 flex justify-between pl-27 text-micro text-muted-foreground tabular-nums">
            <span>{formatDayLabel(windowStart)}</span>
            <span>Now</span>
        </div>
    );
}

function formatDayLabel(ms: number): string {
    return new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'short' }).format(
        new Date(ms)
    );
}

function durationOf(run: MemoryJobSummary): number | null {
    if (!(run.completedAt && run.createdAt)) {
        return null;
    }
    const started = Date.parse(run.createdAt);
    const completed = Date.parse(run.completedAt);
    if (!(Number.isFinite(started) && Number.isFinite(completed))) {
        return null;
    }
    return Math.max(0, completed - started);
}
