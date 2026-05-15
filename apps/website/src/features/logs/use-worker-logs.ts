import * as React from 'react';
import type { WorkerRecord } from './worker-records.ts';

export type WorkerFilter = 'all' | 'running' | 'idle' | 'done' | 'failed';

export function useWorkerLogs(workers: WorkerRecord[]) {
    const [filter, setFilter] = React.useState<WorkerFilter>('all');
    const [query, setQuery] = React.useState('');
    const [selectedWorkerId, setSelectedWorkerId] = React.useState<string | null>(
        workers[0]?.id ?? null
    );

    const filteredWorkers = React.useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();

        return workers.filter((worker) => {
            if (filter !== 'all' && worker.status !== filter) {
                return false;
            }

            if (!normalizedQuery) {
                return true;
            }

            return [worker.name, worker.channel, worker.result?.title ?? '']
                .join(' ')
                .toLowerCase()
                .includes(normalizedQuery);
        });
    }, [filter, query, workers]);

    React.useEffect(() => {
        if (filteredWorkers.some((worker) => worker.id === selectedWorkerId)) {
            return;
        }

        setSelectedWorkerId(filteredWorkers[0]?.id ?? null);
    }, [filteredWorkers, selectedWorkerId]);

    return {
        filter,
        filteredWorkers,
        query,
        selectedWorker: filteredWorkers.find((worker) => worker.id === selectedWorkerId) ?? null,
        setFilter,
        setQuery,
        setSelectedWorkerId,
    };
}
