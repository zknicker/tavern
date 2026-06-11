import { Badge } from '../../components/ui/badge.tsx';
import { BadgeDivider } from '../../components/ui/badge-divider.tsx';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '../../components/ui/table.tsx';
import { formatRelativeTime } from '../../lib/format.ts';
import type { CortexHealthOutput } from '../../lib/trpc.tsx';
import { cn } from '../../lib/utils.ts';
import { CortexHealthTrends } from './cortex-health-trends.tsx';

type CortexHealthData = NonNullable<CortexHealthOutput>;
type CortexTodo = CortexHealthData['todos'][number];
type CortexTodoCompletion = CortexHealthData['todoCompletions'][number];
type CortexTodoProcessing = CortexHealthData['todoProcessing'];
type CortexLibrarianScan = CortexHealthData['scans'][number];

const todoStatusLabels: Record<string, string> = {
    blocked: 'Blocked',
    proposed: 'Queued',
};

export function CortexHealthView({
    health,
    isLoading,
    onSelectPage,
}: {
    health: CortexHealthOutput | null;
    isLoading: boolean;
    onSelectPage: (page: { path: string; topic: string }) => void;
}) {
    if (!health) {
        return (
            <div className="flex h-full min-h-0 items-center justify-center text-muted-foreground text-sm">
                {isLoading ? 'Checking Cortex health...' : 'Cortex health is unavailable.'}
            </div>
        );
    }

    const openTodos = health.todos;
    const completions = health.todoCompletions;

    return (
        <div className="flex h-full min-h-0 flex-col">
            <article className="min-h-0 flex-1 overflow-auto px-6 pt-6 pb-10">
                <div className="w-full">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h1 className="font-semibold text-2xl tracking-tight">Cortex health</h1>
                        <p className="text-muted-foreground text-sm">
                            {formatCount(health.status.topicCount, 'topic')} ·{' '}
                            {formatCount(health.status.pageCount, 'page')} · hub{' '}
                            {health.status.writable ? 'writable' : 'read-only'}
                        </p>
                    </div>

                    {health.runs.length > 0 ? <RunTiles runs={health.runs} /> : null}

                    <CortexHealthTrends history={health.history} />

                    {openTodos.length > 0 || completions.length > 0 ? (
                        <TodoSection
                            completions={completions}
                            onSelectPage={onSelectPage}
                            openTodos={openTodos}
                            processing={health.todoProcessing}
                        />
                    ) : null}

                    {health.scans.map((scan) => (
                        <LibrarianScanSection
                            key={scan.topic}
                            onSelectPage={onSelectPage}
                            scan={scan}
                        />
                    ))}

                    {health.todos.length === 0 &&
                    health.todoCompletions.length === 0 &&
                    health.scans.length === 0 ? (
                        <p className="mt-8 text-muted-foreground text-sm">
                            Nothing needs attention. Todos and scan results will appear here as the
                            agent maintains the wiki.
                        </p>
                    ) : null}
                </div>
            </article>
        </div>
    );
}

function TodoSection({
    completions,
    onSelectPage,
    openTodos,
    processing,
}: {
    completions: CortexTodoCompletion[];
    onSelectPage: (page: { path: string; topic: string }) => void;
    openTodos: CortexTodo[];
    processing: CortexTodoProcessing;
}) {
    return (
        <section className="mt-8">
            <BadgeDivider subtext={todoCadenceLine(processing, openTodos.length)}>
                Todos
            </BadgeDivider>

            {openTodos.length > 0 ? (
                <div className="mt-3 overflow-hidden rounded-lg border border-border/70">
                    <Table className="table-auto">
                        <TableHeader>
                            <TableRow className="bg-muted/25">
                                <TableHead className="px-3 py-2">Todo</TableHead>
                                <TableHead className="w-32 px-3 py-2">Topic</TableHead>
                                <TableHead className="w-16 px-3 py-2">Priority</TableHead>
                                <TableHead className="w-28 px-3 py-2">Status</TableHead>
                                <TableHead className="w-24 px-3 py-2 text-right">Updated</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody className="[&_tr:last-child]:border-b-0">
                            {openTodos.map((todo) => (
                                <TodoRow
                                    isProcessing={
                                        processing.runningPath === todo.path &&
                                        processing.runningTopic === todo.topic
                                    }
                                    key={`${todo.topic}:${todo.path}`}
                                    onSelectPage={onSelectPage}
                                    todo={todo}
                                />
                            ))}
                        </TableBody>
                    </Table>
                </div>
            ) : null}

            {completions.length > 0 ? (
                <div className="mt-3 space-y-1">
                    {completions.map((completion) => (
                        <p
                            className="text-muted-foreground text-sm"
                            key={`${completion.topic}:${completion.date}:${completion.detail}`}
                        >
                            <span aria-hidden className="mr-1.5 text-success">
                                ✓
                            </span>
                            {completion.detail} · {formatCompletionDate(completion.date)}
                        </p>
                    ))}
                </div>
            ) : null}
        </section>
    );
}

function formatCompletionDate(date: string) {
    return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
    });
}

function TodoRow({
    isProcessing,
    onSelectPage,
    todo,
}: {
    isProcessing: boolean;
    onSelectPage: (page: { path: string; topic: string }) => void;
    todo: CortexTodo;
}) {
    return (
        <TableRow>
            <TableCell className="px-3 py-2">
                <button
                    className="cursor-pointer text-left text-foreground hover:underline"
                    onClick={() => onSelectPage({ path: todo.path, topic: todo.topic })}
                    type="button"
                >
                    {todo.title}
                </button>
                {todo.question ? (
                    <p className="mt-0.5 text-muted-foreground text-xs">{todo.question}</p>
                ) : null}
            </TableCell>
            <TableCell className="px-3 py-2 text-muted-foreground">{todo.topic}</TableCell>
            <TableCell className="px-3 py-2 text-muted-foreground uppercase">
                {todo.priority ?? '—'}
            </TableCell>
            <TableCell className="px-3 py-2">
                {isProcessing ? (
                    <span className="flex items-center gap-1.5 font-medium text-foreground">
                        <span aria-hidden className="size-2 animate-pulse rounded-full bg-info" />
                        Processing
                    </span>
                ) : todo.status === 'blocked' ? (
                    <Badge size="sm" variant="warning">
                        Blocked
                    </Badge>
                ) : (
                    <span className="text-muted-foreground">
                        {todoStatusLabels[todo.status] ?? todo.status}
                    </span>
                )}
            </TableCell>
            <TableCell className="px-3 py-2 text-right text-muted-foreground">
                {formatRelativeTime(todo.updatedAt)}
            </TableCell>
        </TableRow>
    );
}

function todoCadenceLine(processing: CortexTodoProcessing, openCount: number) {
    if (processing.runningPath) {
        return 'processing now';
    }
    if (openCount > 0 && processing.nextRunAtMs) {
        return `worked one at a time · next ~${formatClockTime(processing.nextRunAtMs)}`;
    }
    if (openCount > 0) {
        return 'worked one at a time, automatically';
    }
    return undefined;
}

function formatClockTime(ms: number) {
    return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function LibrarianScanSection({
    onSelectPage,
    scan,
}: {
    onSelectPage: (page: { path: string; topic: string }) => void;
    scan: CortexLibrarianScan;
}) {
    const stalenessThreshold = scan.threshold ?? 70;
    const summaryTiles = [
        ['Scanned', scan.articlesScanned],
        ['Stale', scan.staleCount],
        ['Low quality', scan.lowQualityCount],
        ['Avg staleness', scan.avgStaleness],
        ['Avg quality', scan.avgQuality],
    ].filter((entry): entry is [string, number] => entry[1] !== null);

    return (
        <section className="mt-8">
            <BadgeDivider
                subtext={`${scan.topic} · ${formatRelativeTime(scan.completedAt ?? scan.updatedAt)}`}
            >
                Librarian scan
            </BadgeDivider>

            {summaryTiles.length > 0 ? (
                <div className="mt-3 grid grid-cols-3 gap-2 lg:grid-cols-5">
                    {summaryTiles.map(([label, value]) => (
                        <div className="rounded-lg bg-muted/40 px-3 py-2.5" key={label}>
                            <p className="text-muted-foreground text-sm">{label}</p>
                            <p className="mt-0.5 font-medium text-foreground text-sm">
                                {Math.round(value)}
                            </p>
                        </div>
                    ))}
                </div>
            ) : null}

            {scan.articles.length > 0 ? (
                <div className="mt-3 overflow-hidden rounded-lg border border-border/70">
                    <Table className="table-auto">
                        <TableHeader>
                            <TableRow className="bg-muted/25">
                                <TableHead className="px-3 py-2">Article</TableHead>
                                <TableHead className="w-24 px-3 py-2 text-right">
                                    Staleness
                                </TableHead>
                                <TableHead className="w-24 px-3 py-2 text-right">Quality</TableHead>
                                <TableHead className="px-3 py-2">Flags</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody className="[&_tr:last-child]:border-b-0">
                            {scan.articles.map((article) => (
                                <TableRow key={article.path}>
                                    <TableCell className="px-3 py-2">
                                        <button
                                            className="cursor-pointer text-left text-foreground hover:underline"
                                            onClick={() =>
                                                onSelectPage({
                                                    path: article.path,
                                                    topic: scan.topic,
                                                })
                                            }
                                            type="button"
                                        >
                                            {article.path}
                                        </button>
                                    </TableCell>
                                    <TableCell
                                        className={cn(
                                            'px-3 py-2 text-right tabular-nums',
                                            scoreClass(article.stalenessScore, stalenessThreshold)
                                        )}
                                    >
                                        {article.stalenessScore ?? '—'}
                                    </TableCell>
                                    <TableCell
                                        className={cn(
                                            'px-3 py-2 text-right tabular-nums',
                                            scoreClass(article.qualityScore, 50)
                                        )}
                                    >
                                        {article.qualityScore ?? '—'}
                                    </TableCell>
                                    <TableCell className="px-3 py-2">
                                        <span className="flex flex-wrap gap-1">
                                            {article.qualityFlags.map((flag) => (
                                                <Badge key={flag} size="sm" variant="warning">
                                                    {flag}
                                                </Badge>
                                            ))}
                                        </span>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            ) : null}
        </section>
    );
}

function scoreClass(score: null | number, cutoff: number) {
    if (score === null) {
        return 'text-muted-foreground';
    }
    return score < cutoff ? 'font-medium text-warning-foreground' : 'text-muted-foreground';
}

function RunTiles({ runs }: { runs: CortexHealthData['runs'] }) {
    return (
        <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-3">
            {runs.map((run) => (
                <div className="rounded-lg bg-muted/40 px-3 py-2.5" key={run.name}>
                    <p className="text-muted-foreground text-sm">{run.name}</p>
                    <p className="mt-0.5 font-medium text-foreground text-sm">
                        {runStatusLine(run)}
                    </p>
                </div>
            ))}
        </div>
    );
}

function formatCount(count: number, noun: string) {
    return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

function runStatusLine(run: CortexHealthData['runs'][number]) {
    if (run.running) {
        return 'Running now';
    }
    if (run.lastRunAtMs) {
        return `Ran ${formatRelativeTime(new Date(run.lastRunAtMs).toISOString())}`;
    }
    if (run.nextRunAtMs) {
        return `First run ~${formatClockTime(run.nextRunAtMs)}`;
    }
    return 'Not run yet';
}
