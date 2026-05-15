import { queryPolicy } from '../../lib/query-policy.ts';
import { trpc } from '../../lib/trpc.tsx';

export function useMessagingPlatformList() {
    return trpc.messagingPlatform.list.useQuery(undefined, queryPolicy.agentRuntimeSnapshot);
}

export function useMessagingPlatformListSuspense() {
    return trpc.messagingPlatform.list.useSuspenseQuery(
        undefined,
        queryPolicy.agentRuntimeSnapshot
    );
}
