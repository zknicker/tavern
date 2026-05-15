import { queryPolicy } from '../../lib/query-policy.ts';
import { trpc } from '../../lib/trpc.tsx';

export function useModelAccess() {
    return trpc.modelAccess.get.useQuery(undefined, queryPolicy.livePollFast);
}
