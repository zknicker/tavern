import { queryPolicy } from '../../lib/query-policy.ts';
import { trpc } from '../../lib/trpc.tsx';

// Read-only inbox visibility (I4): volatile runtime state — absent when the
// Runtime is unreachable, never a stale cache.
export function useAgentInbox(agentId: string) {
    return trpc.agent.inbox.useQuery({ agentId }, queryPolicy.volatileState);
}

export function useStopAgent() {
    return trpc.agent.stop.useMutation();
}
