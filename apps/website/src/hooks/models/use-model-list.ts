import { queryPolicy } from '../../lib/query-policy.ts';
import { trpc } from '../../lib/trpc.tsx';

export function useModelList() {
    return trpc.model.list.useQuery(undefined, queryPolicy.agentRuntimeSnapshot);
}

export function useModelListSuspense() {
    return trpc.model.list.useSuspenseQuery(undefined, queryPolicy.agentRuntimeSnapshot);
}
