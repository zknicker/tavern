import { queryPolicy } from '../../lib/query-policy.ts';
import { trpc } from '../../lib/trpc.tsx';

/** Agent activity feed (specs/agent-activity.md): bounded, fetched on open. */
export function useAgentActivity(input: { agentId: string; enabled?: boolean; limit?: number }) {
    return trpc.agent.activity.useQuery(
        { agentId: input.agentId, limit: input.limit },
        {
            ...queryPolicy.volatileState,
            enabled: (input.enabled ?? true) && input.agentId.length > 0,
        }
    );
}
