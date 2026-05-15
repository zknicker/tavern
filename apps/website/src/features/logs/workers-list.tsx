import { CheckmarkCircle02Icon, Clock, Search01Icon, XCircle } from '@hugeicons/core-free-icons';
import { Badge, type BadgeProps } from '../../components/ui/badge.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { Input } from '../../components/ui/primitives/input.tsx';
import { ScrollArea } from '../../components/ui/scroll-area.tsx';
import { Spinner } from '../../components/ui/spinner.tsx';
import { cn } from '../../lib/utils.ts';
import type { WorkerFilter } from './use-worker-logs.ts';
import type { WorkerRecord } from './worker-records.ts';

const statusBadgeVariants: Record<WorkerRecord['status'], BadgeProps['variant']> = {
    done: 'success',
    failed: 'destructive',
    idle: 'secondary',
    running: 'info',
};

const filters: { id: WorkerFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'running', label: 'Running' },
    { id: 'idle', label: 'Idle' },
    { id: 'done', label: 'Done' },
    { id: 'failed', label: 'Failed' },
];

interface WorkersListProps {
    filter: WorkerFilter;
    onFilterChange: (value: WorkerFilter) => void;
    onQueryChange: (value: string) => void;
    onSelectWorker: (workerId: string) => void;
    query: string;
    selectedWorkerId: string | null;
    workers: WorkerRecord[];
}

export function WorkersList({
    filter,
    onFilterChange,
    onQueryChange,
    onSelectWorker,
    query,
    selectedWorkerId,
    workers,
}: WorkersListProps) {
    return (
        <div className="flex w-80 flex-col border-border border-r">
            <div className="p-3">
                <div className="relative">
                    <Icon
                        className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                        icon={Search01Icon}
                    />
                    <Input
                        className="pl-9"
                        onChange={(event) => onQueryChange(event.target.value)}
                        placeholder="Search tasks..."
                        value={query}
                    />
                </div>
            </div>

            <div className="flex items-center gap-1 border-border border-b px-3 pb-3">
                {filters.map((item) => (
                    <Button
                        className="h-7 text-xs"
                        key={item.id}
                        onClick={() => onFilterChange(item.id)}
                        size="sm"
                        variant={filter === item.id ? 'secondary' : 'ghost'}
                    >
                        {item.label}
                    </Button>
                ))}
            </div>

            <ScrollArea className="flex-1">
                <div className="flex flex-col">
                    {workers.map((worker) => (
                        <button
                            className={cn(
                                'flex items-start gap-3 border-border border-b px-3 py-3 text-left transition-colors hover:bg-secondary',
                                selectedWorkerId === worker.id && 'bg-secondary'
                            )}
                            key={worker.id}
                            onClick={() => onSelectWorker(worker.id)}
                            type="button"
                        >
                            <div className="mt-0.5">{statusIcons[worker.status]}</div>
                            <div className="flex flex-1 flex-col gap-1 overflow-hidden">
                                <span className="truncate text-foreground text-sm">
                                    {worker.name}
                                </span>
                                <div className="flex items-center gap-2 text-muted-foreground text-xs">
                                    <span>{worker.channel}</span>
                                    <span>-</span>
                                    <span>{worker.completedAt}</span>
                                    <span>-</span>
                                    <span>{worker.toolCount} tools</span>
                                </div>
                            </div>
                            <span className="shrink-0">
                                <Badge variant={statusBadgeVariants[worker.status]}>
                                    {worker.status}
                                </Badge>
                            </span>
                        </button>
                    ))}
                    {workers.length === 0 ? (
                        <div className="px-4 py-6 text-center text-muted-foreground text-sm">
                            No worker entries match the current filters.
                        </div>
                    ) : null}
                </div>
            </ScrollArea>
        </div>
    );
}

const statusIcons = {
    done: <Icon className="size-4 text-success" icon={CheckmarkCircle02Icon} />,
    failed: <Icon className="size-4 text-destructive" icon={XCircle} />,
    idle: <Icon className="size-4 text-muted-foreground" icon={Clock} />,
    running: <Spinner className="size-4 text-teal-400" />,
} satisfies Record<WorkerRecord['status'], React.ReactElement>;
