import { queryPolicy } from '../../lib/query-policy.ts';
import { trpc } from '../../lib/trpc.tsx';

export function useModelInventory() {
    return trpc.model.inventory.useQuery(undefined, queryPolicy.agentRuntimeSnapshot);
}

export function useModelInventorySuspense() {
    return trpc.model.inventory.useSuspenseQuery(undefined, queryPolicy.agentRuntimeSnapshot);
}
