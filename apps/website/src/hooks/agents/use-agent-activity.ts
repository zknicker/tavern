import { queryPolicy } from '../../lib/query-policy.ts';
import { trpc } from '../../lib/trpc.tsx';

export function useAgentActivity() {
    return trpc.agent.activity.useQuery(undefined, queryPolicy.volatileState);
}

export function useAgentActivitySuspense() {
    return trpc.agent.activity.useSuspenseQuery(undefined, queryPolicy.volatileState);
}
