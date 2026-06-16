import { Badge } from '../../components/ui/badge.tsx';
import { formatTimestamp, titleCase } from '../../lib/format.ts';
import type { CronRunsOutput } from '../../lib/trpc.tsx';
import { cn } from '../../lib/utils.ts';
import {
    formatCronRunDeliveryLabel,
    formatCronRunDetail,
    formatCronRunFinishedLabel,
    getCronRunDeliveryVariant,
    resolveCronRunDestinationLabel,
} from './cron-run-view-data.ts';

type CronRun = CronRunsOutput['runs'][number];

interface CronRunFactsProps {
    deliveryDestinationLabel: string | null;
    run: CronRun;
    variant?: 'bare' | 'panel';
}

export function CronRunFacts({
    deliveryDestinationLabel,
    run,
    variant = 'panel',
}: CronRunFactsProps) {
    return (
        <dl
            className={cn(
                'divide-y divide-border/50 text-sm',
                variant === 'panel' && 'rounded-md border border-border/60 bg-muted/10'
            )}
        >
            <Fact
                inset={variant === 'panel'}
                isDate
                label="Scheduled"
                value={formatTimestamp(run.scheduledFor)}
            />
            <Fact
                inset={variant === 'panel'}
                isDate
                label="Started"
                value={run.startedAt ? formatTimestamp(run.startedAt) : 'Not available'}
            />
            <Fact
                inset={variant === 'panel'}
                isDate={Boolean(run.finishedAt)}
                label="Completed"
                value={
                    run.finishedAt
                        ? formatTimestamp(run.finishedAt)
                        : formatCronRunFinishedLabel(run)
                }
            />
            <Fact inset={variant === 'panel'} label="Trigger" value={titleCase(run.trigger)} />
            <Fact
                inset={variant === 'panel'}
                label="Destination"
                value={resolveCronRunDestinationLabel(run.deliveryStatus, deliveryDestinationLabel)}
            />
            <div
                className={cn(
                    'grid gap-1 py-2.5 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:items-center sm:gap-3',
                    variant === 'panel' && 'px-3'
                )}
            >
                <dt className="font-medium text-foreground">Delivery</dt>
                <dd className="min-w-0 sm:text-right">
                    <Badge size="sm" variant={getCronRunDeliveryVariant(run.deliveryStatus)}>
                        {formatCronRunDeliveryLabel(run.deliveryStatus)}
                    </Badge>
                </dd>
            </div>
            <Fact
                inset={variant === 'panel'}
                isCode
                label="Session"
                value={run.sessionId ?? 'Not available'}
            />
            <Fact inset={variant === 'panel'} isCode label="Run" value={run.id} />
        </dl>
    );
}

export function CronRunError({ run }: { run: CronRun }) {
    const detail = formatCronRunDetail(run);
    if (!detail) {
        return null;
    }

    return (
        <section className="rounded-md border border-error/30 bg-error-bg/70 px-3 py-2.5">
            <p className="font-medium text-error-foreground text-sm">Error</p>
            <p className="mt-1 text-pretty text-error-foreground/85 text-sm leading-5">{detail}</p>
        </section>
    );
}

function Fact({
    inset = false,
    isCode = false,
    isDate = false,
    label,
    value,
}: {
    inset?: boolean;
    isCode?: boolean;
    isDate?: boolean;
    label: string;
    value: string;
}) {
    return (
        <div
            className={cn(
                'grid gap-1 py-2.5 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:items-center sm:gap-3',
                inset && 'px-3'
            )}
        >
            <dt className="font-medium text-foreground">{label}</dt>
            <dd
                className={cn(
                    'min-w-0 text-muted-foreground sm:text-right',
                    isCode && 'break-all font-mono',
                    isDate && 'font-mono tabular-nums'
                )}
            >
                {value}
            </dd>
        </div>
    );
}
