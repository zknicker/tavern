import { queryPolicy } from '../../lib/query-policy.ts';
import { trpc } from '../../lib/trpc.tsx';

export function useAgentList() {
    return trpc.agent.list.useQuery(undefined, queryPolicy.agentRuntimeSnapshot);
}

export function useAgentListSuspense() {
    return trpc.agent.list.useSuspenseQuery(undefined, queryPolicy.agentRuntimeSnapshot);
}

export function usePrimaryAgent() {
    return trpc.agent.primary.useQuery(undefined, queryPolicy.agentRuntimeSnapshot);
}

export function usePrimaryAgentSuspense() {
    return trpc.agent.primary.useSuspenseQuery(undefined, queryPolicy.agentRuntimeSnapshot);
}
