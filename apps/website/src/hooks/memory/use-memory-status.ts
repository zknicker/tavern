import { queryPolicy } from '../../lib/query-policy.ts';
import { trpc } from '../../lib/trpc.tsx';

export function useMemoryStatus() {
    return trpc.memory.status.useQuery(undefined, queryPolicy.agentRuntimeSnapshot);
}

export function useMemoryStatusSuspense() {
    return trpc.memory.status.useSuspenseQuery(undefined, queryPolicy.agentRuntimeSnapshot);
}
