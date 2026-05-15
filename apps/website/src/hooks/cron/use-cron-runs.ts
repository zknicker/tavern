import { queryPolicy } from '../../lib/query-policy.ts';
import { trpc } from '../../lib/trpc.tsx';

interface UseCronRunsInput {
    jobId?: string;
    limit?: number;
}

export function useCronRuns(input: null | UseCronRunsInput | undefined = undefined) {
    return trpc.cron.runs.useQuery(input ?? undefined, {
        enabled: input !== null,
        ...queryPolicy.agentRuntimeSnapshot,
    });
}
