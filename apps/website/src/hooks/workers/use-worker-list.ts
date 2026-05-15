import { queryPolicy } from '../../lib/query-policy.ts';
import { trpc } from '../../lib/trpc.tsx';

export function useWorkerList() {
    return trpc.worker.list.useQuery(undefined, queryPolicy.livePollFast);
}

export function useWorkerListSuspense() {
    return trpc.worker.list.useSuspenseQuery(undefined, queryPolicy.livePollFast);
}
