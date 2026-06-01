import { queryPolicy } from '../../lib/query-policy.ts';
import { trpc } from '../../lib/trpc.tsx';

export function useChatList() {
    return trpc.chat.list.useQuery(undefined, queryPolicy.agentRuntimeSnapshot);
}

export function useChatListSuspense() {
    return trpc.chat.list.useSuspenseQuery(undefined, queryPolicy.agentRuntimeSnapshot);
}

export function useChatGet(input: { chatId: string }) {
    return trpc.chat.get.useQuery(input, {
        ...queryPolicy.agentRuntimeSnapshot,
        refetchOnMount: 'always',
    });
}

export function useChatGetSuspense(input: { chatId: string }) {
    return trpc.chat.get.useSuspenseQuery(input, {
        ...queryPolicy.agentRuntimeSnapshot,
        refetchOnMount: 'always',
    });
}
