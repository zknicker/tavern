import { EmptyState } from '../shell/empty-state.tsx';
import { useWorkerLogs } from './use-worker-logs.ts';
import { WorkerDetail } from './worker-detail.tsx';
import type { WorkerRecord } from './worker-records.ts';
import { WorkersList } from './workers-list.tsx';

interface WorkerLogsProps {
    connectionState: 'reachable' | 'unconfigured' | 'unreachable';
    onNavigateToSettings: () => void;
    workers: WorkerRecord[];
}

export function WorkerLogs({ connectionState, onNavigateToSettings, workers }: WorkerLogsProps) {
    const {
        filter,
        filteredWorkers,
        query,
        selectedWorker,
        setFilter,
        setQuery,
        setSelectedWorkerId,
    } = useWorkerLogs(workers);

    if (workers.length === 0) {
        return (
            <EmptyState
                actionLabel="Open settings"
                description={
                    connectionState === 'unconfigured'
                        ? 'Worker logs stay empty until Tavern Runtime is connected.'
                        : 'Tavern Runtime is connected, but no worker logs have streamed in yet.'
                }
                eyebrow="Logs"
                onAction={onNavigateToSettings}
                title={
                    connectionState === 'unconfigured'
                        ? 'No worker logs synced.'
                        : 'No worker activity yet.'
                }
            />
        );
    }

    return (
        <div className="flex flex-1 overflow-hidden">
            <WorkersList
                filter={filter}
                onFilterChange={setFilter}
                onQueryChange={setQuery}
                onSelectWorker={setSelectedWorkerId}
                query={query}
                selectedWorkerId={selectedWorker?.id ?? null}
                workers={filteredWorkers}
            />

            <div className="flex flex-1 flex-col overflow-hidden">
                <WorkerDetail worker={selectedWorker} />
            </div>
        </div>
    );
}
