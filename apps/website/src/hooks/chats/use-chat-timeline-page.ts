import { queryPolicy } from '../../lib/query-policy.ts';
import { trpc } from '../../lib/trpc.tsx';
import { useChatTimelineRows } from './use-chat-timeline-store.tsx';

export function useChatTimelinePage(input: { id: string; limit: number; offset?: number }) {
    const query = trpc.chat.log.list.useQuery(input, queryPolicy.agentRuntimeSnapshot);
    const data = useChatTimelineRows({
        chatId: input.id,
        limit: input.limit,
        logged: query.data,
        offset: input.offset,
    });
    const isPending = query.isPending && data === undefined;

    return {
        ...query,
        data,
        isPending,
    };
}
