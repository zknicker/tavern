import * as React from 'react';
import { queryPolicy } from '../../lib/query-policy.ts';
import { type ChatLogOutput, trpc } from '../../lib/trpc.tsx';
import { useChatTimelineRows } from './use-chat-timeline-store.tsx';

type ChatLogPage = NonNullable<ChatLogOutput>;

export function useChatTimelinePage(input: { id: string; limit: number }) {
    const query = trpc.chat.log.list.useInfiniteQuery(
        {
            id: input.id,
            limit: input.limit,
        },
        {
            ...queryPolicy.agentRuntimeSnapshot,
            getNextPageParam: (lastPage) => getNextChatLogCursor(lastPage),
            getPreviousPageParam: (firstPage) => getPreviousChatLogCursor(firstPage),
            // Refetch on mount only when invalidation events marked the log
            // stale; an unconditional refetch duplicates the event-driven
            // refresh model and reflows the timeline on every chat re-entry.
            refetchOnMount: true,
        }
    );
    const logged = React.useMemo(() => mergeChatLogPages(query.data?.pages), [query.data?.pages]);
    const data = useChatTimelineRows({
        chatId: input.id,
        limit: Math.max(input.limit, logged?.rows.length ?? 0),
        logged,
    });
    const isPending = query.isPending && data === undefined;

    return {
        ...query,
        data,
        isPending,
    };
}

function getPreviousChatLogCursor(page: ChatLogPage) {
    if (page.offset <= 0) {
        return undefined;
    }

    return {
        offset: Math.max(page.offset - page.limit, 0),
    };
}

function getNextChatLogCursor(page: ChatLogPage) {
    const nextOffset = page.offset + page.rows.length;

    return nextOffset < page.total ? { offset: nextOffset } : undefined;
}

function mergeChatLogPages(pages: ChatLogPage[] | undefined): ChatLogPage | undefined {
    if (!(pages && pages.length > 0)) {
        return undefined;
    }

    const latestPage = pages.at(-1);

    if (!latestPage) {
        return undefined;
    }

    const rowsById = new Map<string, ChatLogPage['rows'][number]>();

    for (const page of pages) {
        for (const row of page.rows) {
            rowsById.set(row.id, row);
        }
    }

    return {
        ...latestPage,
        limit: rowsById.size,
        offset: pages[0]?.offset ?? latestPage.offset,
        rows: [...rowsById.values()],
    };
}
