import { queryPolicy } from '../../lib/query-policy.ts';
import { trpc } from '../../lib/trpc.tsx';

export function buildCronGetQueryOptions(jobId: null | string) {
    return {
        enabled: jobId !== null,
        ...queryPolicy.agentRuntimeSnapshot,
        refetchOnMount: 'always' as const,
        staleTime: 0,
    };
}

export function useCronGet(jobId: null | string) {
    return trpc.cron.get.useQuery(
        {
            jobId: jobId ?? '',
        },
        buildCronGetQueryOptions(jobId)
    );
}
