import { queryPolicy } from '../../lib/query-policy.ts';
import { trpc } from '../../lib/trpc.tsx';

export function useLiveUsage() {
    return trpc.usage.live.useQuery(undefined, queryPolicy.livePollSlow);
}

export function useLiveUsageSuspense() {
    return trpc.usage.live.useSuspenseQuery(undefined, queryPolicy.livePollSlow);
}
