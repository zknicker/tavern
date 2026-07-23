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
import { formatTimestamp } from '../../lib/format.ts';
import type { ReminderRunsOutput } from '../../lib/trpc.tsx';
import { cn } from '../../lib/utils.ts';
import { buildChatPath } from '../chats/chat-path.ts';
import {
    ReminderRunError,
    ReminderRunFacts,
    ReminderRunOutput,
    ReminderRunScriptStderr,
} from './reminder-run-detail-sections.tsx';
import {
    formatReminderRunDetail,
    formatReminderRunOutcome,
    getReminderRunDotClassName,
    getReminderRunStatusVariant,
} from './reminder-run-view-data.ts';

interface RemindersRunsCardProps {
    anchorChatId: string | null;
    isPending: boolean;
    runs: ReminderRunsOutput['runs'];
}

type ReminderRun = ReminderRunsOutput['runs'][number];

interface ReminderRunRow {
    anchorChatId: string | null;
    detail: string | null;
    firedLabel: string;
    id: string;
    messageId: string | null;
    outcome: ReminderRun['outcome'];
    run: ReminderRun;
}

// Ported from cron-runs-card.tsx. Reminder runs drop the started/completed
// split, so the table columns collapse to Fired / Outcome / Anchor; the
// expandable-row detail panel is preserved verbatim.
export function RemindersRunsCard({ anchorChatId, isPending, runs }: RemindersRunsCardProps) {
    const [expandedRunId, setExpandedRunId] = React.useState<string | null>(null);
    const rows = React.useMemo(() => buildRows(runs, anchorChatId), [anchorChatId, runs]);

    React.useEffect(() => {
        if (expandedRunId && !rows.some((row) => row.id === expandedRunId)) {
            setExpandedRunId(null);
        }
    }, [expandedRunId, rows]);

    if (rows.length === 0) {
        return <RemindersRunsEmpty isPending={isPending} />;
    }

    return (
        <Table className="table-fixed">
            <colgroup>
                <col className="w-[30%]" />
                <col className="w-[40%]" />
                <col className="w-[30%]" />
            </colgroup>
            <TableHeader>
                <TableRow>
                    <TableHead className="pl-8">Fired</TableHead>
                    <TableHead>Outcome</TableHead>
                    <TableHead className="pr-8 text-right">Anchor</TableHead>
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
                            className="cursor-pointer text-foreground outline-hidden focus-visible:bg-hover"
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
                                    <span className="truncate font-medium">{row.firedLabel}</span>
                                </div>
                            </TableCell>
                            <TableCell>
                                <div className="relative z-20 flex min-w-0 flex-col items-start gap-1">
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
                            </TableCell>
                            <TableCell className="pr-8 text-right">
                                <AnchorLink chatId={row.anchorChatId} messageId={row.messageId} />
                            </TableCell>
                        </TableRow>,
                        expanded ? (
                            <tr
                                className="border-border/60 border-b bg-muted/25"
                                key={`${row.id}:details`}
                            >
                                <td className="px-8 pt-1 pb-4" colSpan={3}>
                                    <div className="grid gap-3 rounded-lg border border-border/70 bg-background/80 p-3">
                                        <ReminderRunFacts
                                            anchorChatId={row.anchorChatId}
                                            run={row.run}
                                            variant="bare"
                                        />
                                        <ReminderRunOutput run={row.run} />
                                        <ReminderRunError run={row.run} />
                                        <ReminderRunScriptStderr run={row.run} />
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

function RunBadge({ run }: { run: ReminderRun }) {
    return (
        <Badge size="sm" variant={getReminderRunStatusVariant(run)}>
            {formatReminderRunOutcome(run)}
        </Badge>
    );
}

function AnchorLink({ chatId, messageId }: { chatId: string | null; messageId: string | null }) {
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
                {chatId}
            </Link>
            {messageId ? (
                <span className="max-w-full truncate font-mono text-[11px] text-muted-foreground">
                    {messageId}
                </span>
            ) : null}
        </div>
    );
}

function RemindersRunsEmpty({ isPending }: { isPending: boolean }) {
    return (
        <div className="flex min-h-[18rem] items-center justify-center">
            <Empty>
                <EmptyHeader>
                    <EmptyTitle>{isPending ? 'Loading runs' : 'No runs yet'}</EmptyTitle>
                    <EmptyDescription>
                        {isPending
                            ? 'Fetching recent reminder runs.'
                            : 'Runs will appear after the reminder fires.'}
                    </EmptyDescription>
                </EmptyHeader>
            </Empty>
        </div>
    );
}

function StatusDot({ run }: { run: ReminderRun }) {
    return (
        <span
            aria-hidden
            className={cn('size-2 shrink-0 rounded-full', getReminderRunDotClassName(run))}
        />
    );
}

function buildRows(
    runs: ReminderRunsOutput['runs'],
    anchorChatId: string | null
): ReminderRunRow[] {
    return runs.map((run) => ({
        anchorChatId,
        detail: formatReminderRunDetail(run),
        firedLabel: formatTimestamp(run.firedAt),
        id: run.id,
        messageId: run.messageId,
        outcome: run.outcome,
        run,
    }));
}
