import { ScrollArea } from '../../components/ui/scroll-area.tsx';
import { useSearch } from '../../hooks/dashboard/use-search.ts';
import type { WorkerListOutput } from '../../lib/trpc.tsx';
import { EmptyState } from '../shell/empty-state.tsx';
import { filterWorkers, type WorkersFilterType } from './filter-workers.ts';
import { WorkerHistogram } from './worker-histogram.tsx';
import { WorkerRow } from './worker-row.tsx';
import { WorkersFilterTabs } from './workers-filter-tabs.tsx';
import { WorkersStats } from './workers-stats.tsx';

interface WorkersViewProps {
    connectionState: 'reachable' | 'unconfigured' | 'unreachable';
    filter: WorkersFilterType;
    onFilterChange: (filter: WorkersFilterType) => void;
    onInspect: (worker: WorkerListOutput['workers'][number]) => void;
    onNavigateToSettings: () => void;
    sync: WorkerListOutput['sync'];
    workers: WorkerListOutput['workers'];
}

function sameDay(a: string, b: string) {
    const da = new Date(a);
    const db = new Date(b);
    return (
        da.getFullYear() === db.getFullYear() &&
        da.getMonth() === db.getMonth() &&
        da.getDate() === db.getDate()
    );
}

export function WorkersView({
    connectionState,
    filter,
    onFilterChange,
    onInspect,
    onNavigateToSettings,
    sync,
    workers,
}: WorkersViewProps) {
    const { deferredQuery } = useSearch();
    const filteredWorkers = filterWorkers({
        filter,
        query: deferredQuery,
        workers,
    });

    if (workers.length === 0) {
        return (
            <EmptyState
                actionLabel={connectionState === 'unconfigured' ? 'Open settings' : undefined}
                description={getEmptyStateDescription({
                    connectionState,
                    syncError: sync.lastError,
                })}
                eyebrow="Workers"
                onAction={connectionState === 'unconfigured' ? onNavigateToSettings : undefined}
                title={
                    connectionState === 'unconfigured' ? 'No workers synced.' : 'No workers yet.'
                }
            />
        );
    }

    return (
        <div className="flex flex-1 flex-col overflow-hidden">
            <div className="border-border/60 border-b px-3 py-1.5 md:hidden">
                <WorkersFilterTabs filter={filter} onFilterChange={onFilterChange} />
            </div>

            <ScrollArea className="flex-1">
                <div className="flex flex-col gap-4 px-4 pt-4 pb-4 lg:px-6">
                    <WorkersStats
                        filter={filter}
                        onFilterChange={onFilterChange}
                        workers={workers}
                    />

                    <WorkerHistogram workers={filteredWorkers} />

                    <div>
                        {filteredWorkers.map((worker, index) => {
                            const prevWorker = filteredWorkers[index - 1];
                            const timestamp = worker.lastEventAt ?? worker.createdAt;
                            const prevTimestamp = prevWorker
                                ? (prevWorker.lastEventAt ?? prevWorker.createdAt)
                                : null;
                            const showDayDivider =
                                index === 0 ||
                                (prevTimestamp !== null && !sameDay(timestamp, prevTimestamp));

                            return (
                                <WorkerRow
                                    isLast={index === filteredWorkers.length - 1}
                                    key={worker.id}
                                    onInspect={onInspect}
                                    showDayDivider={showDayDivider}
                                    worker={worker}
                                />
                            );
                        })}
                    </div>
                </div>
            </ScrollArea>
        </div>
    );
}

function getEmptyStateDescription(input: {
    connectionState: 'reachable' | 'unconfigured' | 'unreachable';
    syncError: string | null;
}) {
    const syncError = input.syncError?.trim();

    if (syncError) {
        return syncError;
    }

    if (input.connectionState === 'unconfigured') {
        return 'Start Tavern Runtime to sync workers and execution state.';
    }

    return 'Tavern Runtime is connected, but no workers have been materialized yet.';
}
