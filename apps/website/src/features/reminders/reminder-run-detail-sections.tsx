import { Link } from 'react-router-dom';
import { formatTimestamp } from '../../lib/format.ts';
import type { ReminderRunsOutput } from '../../lib/trpc.tsx';
import { cn } from '../../lib/utils.ts';
import { buildChatPath } from '../chats/chat-path.ts';
import { formatReminderRunOutcome } from './reminder-run-view-data.ts';

// Ported from cron-run-detail-sections.tsx. Reminder runs have a single fire
// time (no scheduled/started/finished split or duration), so the Facts list
// collapses accordingly while keeping the dl/Fact markup verbatim.
type ReminderRun = ReminderRunsOutput['runs'][number];

interface ReminderRunFactsProps {
    anchorChatId: string | null;
    run: ReminderRun;
    variant?: 'bare' | 'panel';
}

export function ReminderRunFacts({ anchorChatId, run, variant = 'panel' }: ReminderRunFactsProps) {
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
                label="Fired"
                value={formatTimestamp(run.firedAt)}
            />
            <Fact
                inset={variant === 'panel'}
                label="Outcome"
                value={formatReminderRunOutcome(run)}
            />
            {run.scriptExitCode === null ? null : (
                <Fact
                    inset={variant === 'panel'}
                    isCode
                    label="Exit code"
                    value={String(run.scriptExitCode)}
                />
            )}
            <ChatFact anchorChatId={anchorChatId} inset={variant === 'panel'} />
            <Fact
                inset={variant === 'panel'}
                isCode
                label="Message"
                value={run.messageId ?? 'None'}
            />
            <Fact inset={variant === 'panel'} isCode label="Run" value={run.id} />
        </dl>
    );
}

export function ReminderRunOutput({ run }: { run: ReminderRun }) {
    const output = run.output?.trim();
    if (!output) {
        return null;
    }

    return (
        <section className="rounded-md border border-border/60 bg-muted/10 px-3 py-2.5">
            <p className="font-medium text-foreground text-sm">Output</p>
            <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-all font-mono text-muted-foreground text-xs leading-5">
                {output}
            </pre>
        </section>
    );
}

export function ReminderRunError({ run }: { run: ReminderRun }) {
    if (run.outcome !== 'error') {
        return null;
    }

    return (
        <section className="rounded-md border border-error/30 bg-error-bg/70 px-3 py-2.5">
            <p className="font-medium text-error-foreground text-sm">Error</p>
            <p className="mt-1 text-pretty text-error-foreground/85 text-sm leading-5">
                {run.errorMessage?.trim() || 'Reminder script failed.'}
            </p>
        </section>
    );
}

export function ReminderRunScriptStderr({ run }: { run: ReminderRun }) {
    if (!run.scriptStderr) {
        return null;
    }

    return (
        <section className="rounded-md border border-border/60 bg-muted/10 px-3 py-2.5">
            <p className="font-medium text-foreground text-sm">Script stderr</p>
            <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-all font-mono text-muted-foreground text-xs leading-5">
                {run.scriptStderr}
            </pre>
        </section>
    );
}

function ChatFact({ anchorChatId, inset }: { anchorChatId: string | null; inset: boolean }) {
    return (
        <div
            className={cn(
                'grid gap-1 py-2.5 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:items-center sm:gap-3',
                inset && 'px-3'
            )}
        >
            <dt className="font-medium text-foreground">Anchor</dt>
            <dd className="min-w-0 sm:text-right">
                {anchorChatId ? (
                    <Link
                        className="min-w-0 truncate text-link underline-offset-4 hover:underline"
                        to={buildChatPath(anchorChatId)}
                    >
                        {anchorChatId}
                    </Link>
                ) : (
                    <span className="text-muted-foreground">None</span>
                )}
            </dd>
        </div>
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
