import { queryPolicy } from '../../lib/query-policy.ts';
import { trpc } from '../../lib/trpc.tsx';

export function useChatList() {
    return trpc.chat.list.useQuery(undefined, queryPolicy.agentRuntimeSnapshot);
}

export function useChatListSuspense() {
    return trpc.chat.list.useSuspenseQuery(undefined, queryPolicy.agentRuntimeSnapshot);
}
