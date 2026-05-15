import { Card, CardContent } from '../../components/ui/card.tsx';
import type { WorkerListOutput } from '../../lib/trpc.tsx';
import { cn } from '../../lib/utils.ts';
import { workerKindConfig } from './config.ts';

const histogramWindowMs = 24 * 60 * 60 * 1000;
const histogramBucketMs = 5 * 60 * 1000;
const histogramBuckets = histogramWindowMs / histogramBucketMs;

export function WorkerHistogram({ workers }: { workers: WorkerListOutput['workers'] }) {
    if (workers.length === 0) {
        return null;
    }

    const now = Date.now();
    const windowStart = now - histogramWindowMs;
    const buckets = Array.from({ length: histogramBuckets }, () => ({
        acp: 0,
        cli: 0,
        cron: 0,
        subagent: 0,
    }));

    for (const worker of workers) {
        const timestamp = new Date(worker.lastEventAt ?? worker.createdAt).getTime();

        if (Number.isNaN(timestamp) || timestamp < windowStart || timestamp > now) {
            continue;
        }

        const bucketIndex = Math.min(
            Math.floor((timestamp - windowStart) / histogramBucketMs),
            histogramBuckets - 1
        );

        if (buckets[bucketIndex]) {
            buckets[bucketIndex][worker.kind] += 1;
        }
    }

    const maxCount = Math.max(
        ...buckets.map((bucket) => bucket.acp + bucket.cli + bucket.cron + bucket.subagent),
        1
    );
    const ticks = Array.from({ length: 5 }, (_, index) => {
        const progress = index / 4;

        return {
            label: formatAxisLabel(windowStart + progress * histogramWindowMs),
            leftPct: progress * 100,
        };
    });

    return (
        <Card>
            <CardContent className="px-4 pt-4 pb-2">
                <div className="mb-2 font-semibold text-foreground text-xs uppercase tracking-wider">
                    24-hour activity
                </div>
                <div className="flex h-20 w-full items-end gap-px">
                    {buckets.map((bucket, index) => {
                        const total = bucket.acp + bucket.cli + bucket.cron + bucket.subagent;
                        const heightPct = (total / maxCount) * 100;

                        return (
                            <div
                                className="flex flex-1 justify-center"
                                key={String(index)}
                                style={{ height: `${Math.max(heightPct, total > 0 ? 6 : 0)}%` }}
                            >
                                <span
                                    className="size-full rounded-[2px]"
                                    style={{ backgroundColor: getBarColor(bucket) }}
                                />
                            </div>
                        );
                    })}
                </div>
                <div className="relative mt-1.5 h-4">
                    {ticks.map((tick, index) => (
                        <span
                            className={cn(
                                'absolute font-mono text-caption text-muted-foreground/60',
                                getTickTransformClass(index, ticks.length)
                            )}
                            key={tick.label}
                            style={{ left: `${tick.leftPct}%` }}
                        >
                            {tick.label}
                        </span>
                    ))}
                </div>

                <div className="mt-2 flex items-center gap-4 border-border/40 border-t pt-2">
                    {(['cron', 'acp', 'subagent', 'cli'] as const).map((kind) => {
                        const config = workerKindConfig[kind];
                        return (
                            <div className="flex items-center gap-1.5" key={kind}>
                                <span
                                    className="size-2 rounded-full"
                                    style={{ backgroundColor: config.accent }}
                                />
                                <span className="text-muted-foreground text-xs">
                                    {config.label}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}

function formatAxisLabel(timestamp: number) {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
        return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }

    return date.toLocaleDateString('en-US', {
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        month: 'short',
    });
}

function getBarColor(bucket: { acp: number; cli: number; cron: number; subagent: number }) {
    if (
        bucket.subagent >= bucket.cron &&
        bucket.subagent >= bucket.acp &&
        bucket.subagent >= bucket.cli &&
        bucket.subagent > 0
    ) {
        return 'oklch(from var(--success) l c h / 0.5)';
    }

    if (bucket.cron >= bucket.acp && bucket.cron >= bucket.cli && bucket.cron > 0) {
        return 'oklch(from var(--warning) l c h / 0.5)';
    }

    if (bucket.acp >= bucket.cli && bucket.acp > 0) {
        return 'oklch(from var(--brand) l c h / 0.5)';
    }

    if (bucket.cli > 0) {
        return 'oklch(from var(--info) l c h / 0.5)';
    }

    return 'oklch(from var(--muted-foreground) l c h / 0.3)';
}

function getTickTransformClass(index: number, tickCount: number) {
    if (index === tickCount - 1) {
        return '-translate-x-full';
    }

    if (index === 0) {
        return '';
    }

    return '-translate-x-1/2';
}
