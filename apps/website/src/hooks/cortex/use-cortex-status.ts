import { queryPolicy } from '../../lib/query-policy.ts';
import { trpc } from '../../lib/trpc.tsx';

export function useCortexStatus() {
    return trpc.cortex.status.useQuery(undefined, queryPolicy.agentRuntimeSnapshot);
}

export function useCortexStatusSuspense() {
    return trpc.cortex.status.useSuspenseQuery();
}
