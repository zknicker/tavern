import { queryPolicy } from '../../lib/query-policy.ts';
import { trpc } from '../../lib/trpc.tsx';

export function useCronList() {
    return trpc.cron.list.useQuery(undefined, queryPolicy.agentRuntimeSnapshot);
}

export function useCronListSuspense() {
    return trpc.cron.list.useSuspenseQuery(undefined, queryPolicy.agentRuntimeSnapshot);
}
