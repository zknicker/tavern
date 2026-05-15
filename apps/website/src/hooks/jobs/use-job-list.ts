import { queryPolicy } from '../../lib/query-policy.ts';
import { trpc } from '../../lib/trpc.tsx';

export function useJobList() {
    return trpc.jobs.list.useQuery(undefined, queryPolicy.syncedSnapshot);
}

export function useJobListSuspense() {
    return trpc.jobs.list.useSuspenseQuery(undefined, queryPolicy.syncedSnapshot);
}
