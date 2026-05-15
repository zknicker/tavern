import { queryPolicy } from '../lib/query-policy.ts';
import { trpc } from '../lib/trpc.tsx';

export function useLogs() {
    return trpc.log.list.useQuery(undefined, queryPolicy.syncedSnapshot);
}

export function useLogsSuspense() {
    return trpc.log.list.useSuspenseQuery(undefined, queryPolicy.syncedSnapshot);
}
