import { queryPolicy } from '../../lib/query-policy.ts';
import { trpc } from '../../lib/trpc.tsx';

export function useAgentChatListSuspense(input: { agentId: string }) {
    return trpc.agent.chats.list.useSuspenseQuery(input, queryPolicy.agentRuntimeSnapshot);
}
