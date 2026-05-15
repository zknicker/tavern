import { Badge } from '../../components/ui/badge.tsx';
import { DayDivider, formatDayLabel } from '../../components/ui/day-divider.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { formatRelativeTime } from '../../lib/format.ts';
import type { WorkerListOutput } from '../../lib/trpc.tsx';
import { workerKindConfig, workerStatusVariants } from './config.ts';

function formatWorkerTime(value: string) {
    const date = new Date(value);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function WorkerRow({
    isLast,
    onInspect,
    showDayDivider,
    worker,
}: {
    isLast: boolean;
    onInspect: (worker: WorkerListOutput['workers'][number]) => void;
    showDayDivider: boolean;
    worker: WorkerListOutput['workers'][number];
}) {
    const config = workerKindConfig[worker.kind];
    const inspectable = Boolean(worker.sessionKey);
    const timestamp = worker.lastEventAt ?? worker.createdAt;

    return (
        <div>
            {showDayDivider ? (
                <DayDivider className="mb-3 pt-1" label={formatDayLabel(timestamp)} />
            ) : null}

            <div className="grid grid-cols-[5rem_1.75rem_minmax(0,1fr)] gap-x-3 pb-0">
                <div className="flex h-8 items-center justify-end font-mono text-muted-foreground text-sm">
                    {formatWorkerTime(timestamp)}
                </div>

                <div className="relative flex justify-center">
                    <div
                        className={`relative z-10 mt-0.5 flex size-7 items-center justify-center rounded-full ring-[3px] ring-background ${config.bg}`}
                    >
                        <Icon
                            aria-hidden="true"
                            disableSecondaryOpacity={true}
                            icon={config.icon}
                            primaryColor={config.accent}
                            secondaryColor={config.accentMuted}
                            size={14}
                            strokeWidth={1.8}
                        />
                    </div>
                    {isLast ? null : (
                        <div className="absolute top-7 bottom-0 left-1/2 w-px -translate-x-1/2 bg-border" />
                    )}
                </div>

                <div className="min-w-0 pb-4">
                    <button
                        className="group flex w-full min-w-0 cursor-pointer items-start text-left disabled:cursor-default"
                        disabled={!inspectable}
                        onClick={() => onInspect(worker)}
                        type="button"
                    >
                        <div className="min-w-0 flex-1">
                            <div className="flex h-8 items-center gap-2">
                                <span className="truncate font-medium text-foreground text-sm transition-colors group-hover:text-brand group-disabled:group-hover:text-foreground">
                                    {worker.title}
                                </span>
                                <span className="ml-0.5 shrink-0">
                                    <Badge variant={config.badgeVariant}>{config.label}</Badge>
                                </span>
                                <Badge variant={workerStatusVariants[worker.status]}>
                                    {worker.status}
                                </Badge>
                                <span className="ml-auto shrink-0 font-mono text-muted-foreground/50 text-xs tabular-nums">
                                    {formatRelativeTime(timestamp)}
                                </span>
                            </div>

                            {worker.detail ? (
                                <p className="line-clamp-2 max-w-3xl text-muted-foreground text-sm leading-relaxed">
                                    {worker.detail}
                                </p>
                            ) : (
                                <p className="line-clamp-2 max-w-3xl text-muted-foreground/50 text-sm leading-relaxed">
                                    {formatWorkerFallback(worker)}
                                </p>
                            )}
                        </div>
                    </button>
                </div>
            </div>
        </div>
    );
}

function formatWorkerFallback(worker: WorkerListOutput['workers'][number]) {
    const parts = [
        worker.agentName ? `agent ${worker.agentName}` : null,
        worker.childSessionKey ? `session ${worker.childSessionKey}` : null,
        worker.requesterSessionKey ? `requested by ${worker.requesterSessionKey}` : null,
    ].filter((value): value is string => Boolean(value));

    return parts.join(' · ') || 'Background worker';
}
