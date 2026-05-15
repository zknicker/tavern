import { queryPolicy } from '../../lib/query-policy.ts';
import { trpc } from '../../lib/trpc.tsx';

export function useSessionList() {
    return trpc.session.list.useQuery(undefined, queryPolicy.syncedSnapshot);
}

export function useSessionListSuspense() {
    return trpc.session.list.useSuspenseQuery(undefined, queryPolicy.syncedSnapshot);
}
