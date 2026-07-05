import { queryPolicy } from '../../lib/query-policy.ts';
import { trpc } from '../../lib/trpc.tsx';
import { useWorkerEvents } from '../workers/use-worker-events.ts';

const timelineDays = 14;
const timelineLimit = 200;

/** Per-kind worker status: enabled, last run, next run. */
export function useMemoryWorkers() {
    useWorkerEvents();
    return trpc.memory.workers.useQuery(undefined, queryPolicy.agentRuntimeSnapshot);
}

/** Runs across every worker kind over the trailing timeline window. */
export function useMemoryTimeline() {
    useWorkerEvents();
    return trpc.memory.jobs.useQuery(
        { limit: timelineLimit, sinceDays: timelineDays },
        {
            ...queryPolicy.agentRuntimeSnapshot,
            refetchInterval: (query) =>
                query.state.data?.jobs.some(
                    (job) => job.status === 'queued' || job.status === 'running'
                )
                    ? 2500
                    : false,
        }
    );
}
