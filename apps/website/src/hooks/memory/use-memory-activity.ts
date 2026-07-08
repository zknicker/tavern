import { queryPolicy } from '../../lib/query-policy.ts';
import { trpc } from '../../lib/trpc.tsx';
import { useWorkerEvents } from '../workers/use-worker-events.ts';

const timelineDays = 14;
const timelineLimit = 200;

/** Per-kind activity status: enabled, last run, next run. */
export function useMemoryActivity() {
    useWorkerEvents();
    return trpc.memory.activity.useQuery(undefined, queryPolicy.agentRuntimeSnapshot);
}

/** Runs across every activity kind over the trailing timeline window. */
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
