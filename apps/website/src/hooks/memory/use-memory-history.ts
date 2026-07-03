import { queryPolicy } from '../../lib/query-policy.ts';
import { trpc } from '../../lib/trpc.tsx';

const activeJobPollMs = 2500;

export function useMemoryJobList() {
    return trpc.memory.jobs.useQuery(
        { limit: 50 },
        {
            ...queryPolicy.agentRuntimeSnapshot,
            refetchInterval: (query) =>
                query.state.data?.jobs.some(
                    (job) => job.status === 'queued' || job.status === 'running'
                )
                    ? activeJobPollMs
                    : false,
        }
    );
}

export function useMemoryJobDetail(jobId: string | null) {
    return trpc.memory.getJob.useQuery(
        { id: jobId ?? '' },
        {
            ...queryPolicy.agentRuntimeSnapshot,
            enabled: Boolean(jobId),
            refetchInterval: (query) => {
                const status = query.state.data?.status;
                return status === 'queued' || status === 'running' ? activeJobPollMs : false;
            },
        }
    );
}

export function useRunMemoryDream(onQueued?: (jobId: string) => void) {
    const utils = trpc.useUtils();
    return trpc.memory.runDream.useMutation({
        async onSuccess(result) {
            onQueued?.(result.job.id);
            await Promise.all([
                utils.memory.jobs.invalidate(),
                utils.memory.getJob.invalidate({ id: result.job.id }),
            ]);
        },
    });
}

export function useMemoryEnabled() {
    return trpc.memory.settings.useQuery(undefined, queryPolicy.agentRuntimeSnapshot);
}

export function useSaveMemoryEnabled() {
    const utils = trpc.useUtils();
    return trpc.memory.saveSettings.useMutation({
        async onSuccess() {
            await utils.memory.settings.invalidate();
        },
    });
}
