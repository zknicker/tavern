import { queryPolicy } from '../../lib/query-policy.ts';
import { trpc } from '../../lib/trpc.tsx';

export function useAgentChatList(input: { agentId: string; includeArchived?: boolean }) {
    return trpc.agent.chats.list.useQuery(input, queryPolicy.agentRuntimeSnapshot);
}

export function useAgentChatListSuspense(input: { agentId: string; includeArchived?: boolean }) {
    return trpc.agent.chats.list.useSuspenseQuery(input, queryPolicy.agentRuntimeSnapshot);
}
