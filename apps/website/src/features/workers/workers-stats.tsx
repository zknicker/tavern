import { Card, CardContent } from '../../components/ui/card.tsx';
import type { WorkerListOutput } from '../../lib/trpc.tsx';
import type { WorkersFilterType } from './filter-workers.ts';

const statStyles = [
    {
        color: 'text-warning',
        filterKey: 'cron' as const,
        label: 'Cron',
    },
    {
        color: 'text-brand',
        filterKey: 'acp' as const,
        label: 'ACP',
    },
    {
        color: 'text-success',
        filterKey: 'subagent' as const,
        label: 'Delegated',
    },
    {
        color: 'text-info',
        filterKey: 'cli' as const,
        label: 'CLI',
    },
];

interface WorkersStatsProps {
    filter: WorkersFilterType;
    onFilterChange: (filter: WorkersFilterType) => void;
    workers: WorkerListOutput['workers'];
}

export function WorkersStats({ filter, onFilterChange, workers }: WorkersStatsProps) {
    return (
        <div className="grid flex-shrink-0 grid-cols-2 gap-3 lg:grid-cols-4">
            {statStyles.map((stat) => {
                const count = workers.filter((w) => w.kind === stat.filterKey).length;
                const running = workers.filter(
                    (w) =>
                        w.kind === stat.filterKey &&
                        (w.status === 'running' || w.status === 'waiting')
                ).length;
                const isActive = filter === stat.filterKey;

                return (
                    <Card
                        className={`cursor-pointer transition-colors ${isActive ? 'border-ring bg-accent ring-1 ring-ring' : 'border-border bg-card hover:bg-accent'}`}
                        key={stat.filterKey}
                        onClick={() => onFilterChange(isActive ? 'all' : stat.filterKey)}
                    >
                        <CardContent className="px-4 py-3">
                            <div className="text-muted-foreground text-sm">{stat.label}</div>
                            <div className={`mt-1 font-bold text-2xl tracking-tight ${stat.color}`}>
                                {count.toLocaleString()}
                            </div>
                            <div className="mt-0.5 text-muted-foreground text-xs">
                                {running > 0 ? `${running} active` : 'idle'}
                            </div>
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
}
