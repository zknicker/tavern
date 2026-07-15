import { queryPolicy } from '../../lib/query-policy.ts';
import { trpc } from '../../lib/trpc.tsx';

export function useAgentPresence() {
    return trpc.agent.presence.useQuery(undefined, queryPolicy.volatileState);
}

export function useAgentPresenceSuspense() {
    return trpc.agent.presence.useSuspenseQuery(undefined, queryPolicy.volatileState);
}
