import { ArrowDown01Icon } from '@hugeicons-pro/core-solid-rounded';
import * as React from 'react';
import { Link } from 'react-router-dom';

import { Badge } from '../../components/ui/badge.tsx';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '../../components/ui/empty.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '../../components/ui/table.tsx';
import { formatTimestamp, titleCase } from '../../lib/format.ts';
import type { CronRunsOutput } from '../../lib/trpc.tsx';
import { cn } from '../../lib/utils.ts';
import { buildChatPath } from '../chats/chat-path.ts';
import { CronRunError, CronRunFacts, CronRunScriptStderr } from './cron-run-detail-sections.tsx';
import {
    formatCronRunDetail,
    formatCronRunDuration,
    formatCronRunFinishedLabel,
    formatCronRunOutcome,
    getCronRunDotClassName,
    getCronRunStatusVariant,
    isQuietCronRun,
} from './cron-run-view-data.ts';

interface CronRunsCardProps {
    deliveryDestinationLabel: string | null;
    isPending: boolean;
    runs: CronRunsOutput['runs'];
}

type CronRun = CronRunsOutput['runs'][number];

interface CronRunRow {
    chatId: string | null;
    detail: string | null;
    durationLabel: string;
    finishedLabel: string;
    id: string;
    run: CronRun;
    scheduledLabel: string;
    startedLabel: string;
    status: CronRun['status'];
    triggerLabel: string;
    turnId: string | null;
}

export function CronRunsCard({ deliveryDestinationLabel, isPending, runs }: CronRunsCardProps) {
    const [expandedRunId, setExpandedRunId] = React.useState<string | null>(null);
    const rows = React.useMemo(() => buildRows(runs), [runs]);

    React.useEffect(() => {
        if (expandedRunId && !rows.some((row) => row.id === expandedRunId)) {
            setExpandedRunId(null);
        }
    }, [expandedRunId, rows]);

    if (rows.length === 0) {
        return <CronRunsEmpty isPending={isPending} />;
    }

    return (
        <Table className="table-fixed">
            <colgroup>
                <col className="w-[24%]" />
                <col className="w-[24%]" />
                <col className="w-[22%]" />
                <col className="hidden w-[16%] sm:table-column" />
                <col className="w-[30%] sm:w-[14%]" />
            </colgroup>
            <TableHeader>
                <TableRow>
                    <TableHead className="pl-8">Started</TableHead>
                    <TableHead>Completed</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden sm:table-cell">Trigger</TableHead>
                    <TableHead className="pr-8 text-right">Chat</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {rows.flatMap((row, index) => {
                    const expanded = expandedRunId === row.id;
                    const toggleExpanded = () => {
                        setExpandedRunId(expanded ? null : row.id);
                    };

                    return [
                        <TableRow
                            aria-expanded={expanded}
                            className={cn(
                                'cursor-pointer outline-hidden focus-visible:bg-hover',
                                row.chatId && 'text-foreground'
                            )}
                            index={index}
                            key={row.id}
                            onClick={toggleExpanded}
                            onKeyDown={(event) => {
                                if (event.key !== 'Enter' && event.key !== ' ') {
                                    return;
                                }

                                event.preventDefault();
                                toggleExpanded();
                            }}
                            role="button"
                            tabIndex={0}
                            title={row.detail ?? undefined}
                        >
                            <TableCell className="pl-8">
                                <div className="relative z-20 flex min-w-0 items-center gap-2">
                                    <Icon
                                        aria-hidden
                                        className={cn(
                                            'size-3.5 shrink-0 text-muted-foreground transition-transform',
                                            expanded && 'rotate-180'
                                        )}
                                        icon={ArrowDown01Icon}
                                    />
                                    <StatusDot run={row.run} />
                                    <span className="truncate font-medium">{row.startedLabel}</span>
                                </div>
                            </TableCell>
                            <TableCell>
                                <div className="relative z-20">
                                    <RunOutcome row={row} />
                                </div>
                            </TableCell>
                            <TableCell>
                                <div className="relative z-20">
                                    <RunStatus row={row} />
                                </div>
                            </TableCell>
                            <TableCell className="hidden text-muted-foreground sm:table-cell">
                                <span className="relative z-20">{row.triggerLabel}</span>
                            </TableCell>
                            <TableCell className="pr-8 text-right">
                                <ChatLink
                                    chatId={row.chatId}
                                    label={deliveryDestinationLabel}
                                    turnId={row.turnId}
                                />
                            </TableCell>
                        </TableRow>,
                        expanded ? (
                            <tr
                                className="border-border/60 border-b bg-muted/25"
                                key={`${row.id}:details`}
                            >
                                <td className="px-8 pt-1 pb-4" colSpan={5}>
                                    <div className="grid gap-3 rounded-lg border border-border/70 bg-background/80 p-3">
                                        <CronRunFacts
                                            deliveryDestinationLabel={deliveryDestinationLabel}
                                            run={row.run}
                                            variant="bare"
                                        />
                                        <CronRunError run={row.run} />
                                        <CronRunScriptStderr run={row.run} />
                                    </div>
                                </td>
                            </tr>
                        ) : null,
                    ];
                })}
            </TableBody>
        </Table>
    );
}

function RunOutcome({ row }: { row: CronRunRow }) {
    if (row.status === 'success') {
        return (
            <div className="flex min-w-0 flex-col">
                <span className="text-foreground">{row.finishedLabel}</span>
                <span className="text-muted-foreground text-xs">{row.durationLabel}</span>
            </div>
        );
    }

    return (
        <div className="flex min-w-0 flex-col items-start gap-1">
            <RunBadge run={row.run} />
            {row.detail ? (
                <span
                    className="max-w-full truncate text-muted-foreground text-xs"
                    title={row.detail}
                >
                    {row.detail}
                </span>
            ) : null}
        </div>
    );
}

function RunStatus({ row }: { row: CronRunRow }) {
    return (
        <div className="flex min-w-0 flex-col items-start gap-1">
            <div className="flex min-w-0 items-center gap-2">
                <RunBadge run={row.run} />
                <span className="truncate text-muted-foreground text-xs">{row.scheduledLabel}</span>
            </div>
            {row.detail ? (
                <span
                    className="max-w-full truncate text-muted-foreground text-xs"
                    title={row.detail}
                >
                    {row.detail}
                </span>
            ) : null}
        </div>
    );
}

function RunBadge({ run }: { run: CronRun }) {
    return (
        <Badge
            size="sm"
            variant={isQuietCronRun(run) ? 'secondary' : getCronRunStatusVariant(run.status)}
        >
            {formatCronRunOutcome(run)}
        </Badge>
    );
}

function ChatLink({
    chatId,
    label,
    turnId,
}: {
    chatId: string | null;
    label: string | null;
    turnId: string | null;
}) {
    if (!chatId) {
        return <span className="relative z-20 text-muted-foreground">-</span>;
    }

    return (
        <div className="relative z-20 flex min-w-0 flex-col items-end">
            <Link
                className="max-w-full truncate text-link text-xs underline-offset-4 hover:underline"
                onClick={(event) => event.stopPropagation()}
                to={buildChatPath(chatId)}
            >
                {label ?? chatId}
            </Link>
            {turnId ? (
                <span className="max-w-full truncate font-mono text-[11px] text-muted-foreground">
                    {turnId}
                </span>
            ) : null}
        </div>
    );
}

function CronRunsEmpty({ isPending }: { isPending: boolean }) {
    return (
        <div className="flex min-h-[18rem] items-center justify-center">
            <Empty>
                <EmptyHeader>
                    <EmptyTitle>{isPending ? 'Loading runs' : 'No runs yet'}</EmptyTitle>
                    <EmptyDescription>
                        {isPending
                            ? 'Fetching recent automation runs.'
                            : 'Runs will appear after the automation fires.'}
                    </EmptyDescription>
                </EmptyHeader>
            </Empty>
        </div>
    );
}

function StatusDot({ run }: { run: CronRun }) {
    return (
        <span
            aria-hidden
            className={cn('size-2 shrink-0 rounded-full', getCronRunDotClassName(run))}
        />
    );
}

function buildRows(runs: CronRunsOutput['runs']): CronRunRow[] {
    return runs.map((run) => ({
        chatId: run.chatId,
        detail: formatCronRunDetail(run),
        durationLabel: formatCronRunDuration(run),
        finishedLabel: formatCronRunFinishedLabel(run),
        id: run.id,
        run,
        scheduledLabel: formatTimestamp(run.scheduledFor),
        startedLabel: formatTimestamp(run.startedAt ?? run.scheduledFor),
        status: run.status,
        triggerLabel: titleCase(run.trigger),
        turnId: run.turnId,
    }));
}
