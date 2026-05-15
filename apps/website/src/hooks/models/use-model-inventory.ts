import { queryPolicy } from '../../lib/query-policy.ts';
import { trpc } from '../../lib/trpc.tsx';

export function useModelInventory() {
    return trpc.model.inventory.useQuery(undefined, queryPolicy.agentRuntimeSnapshot);
}
