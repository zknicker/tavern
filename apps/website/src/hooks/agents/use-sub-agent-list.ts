import { queryPolicy } from '../../lib/query-policy.ts';
import { trpc } from '../../lib/trpc.tsx';

export function useSubAgentList() {
    return trpc.subAgent.list.useQuery(undefined, queryPolicy.agentRuntimeSnapshot);
}

export function useSubAgentListSuspense() {
    return trpc.subAgent.list.useSuspenseQuery(undefined, queryPolicy.agentRuntimeSnapshot);
}
