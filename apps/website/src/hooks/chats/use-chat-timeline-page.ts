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
            // Older history chains FORWARD from the newest page. React Query
            // refetches an infinite query front-to-back, re-deriving each
            // next cursor from the freshly fetched page — so page 0 must be
            // the cursorless newest window. Chaining older pages backwards
            // poisons the cache on refetch: the stored older-history cursor
            // in page 0 pins every refetch to a stale window and truncates
            // the newer pages, freezing the transcript mid-turn.
            getNextPageParam: (lastPage) => getPreviousChatLogCursor(lastPage),
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
        // Product-named pagination surface: "older history" loads past the
        // oldest loaded row.
        fetchOlderHistory: query.fetchNextPage,
        hasOlderHistory: Boolean(query.hasNextPage),
        isFetchingOlderHistory: query.isFetchingNextPage,
        isPending,
    };
}

function getPreviousChatLogCursor(page: ChatLogPage) {
    return page.nextBeforeSequence === null
        ? undefined
        : { beforeSequence: page.nextBeforeSequence };
}

// Pages are ordered newest-first; the newest page carries live turn state
// and totals, while the oldest page's cursor says whether older history
// remains beyond the loaded set.
function mergeChatLogPages(pages: ChatLogPage[] | undefined): ChatLogPage | undefined {
    if (!(pages && pages.length > 0)) {
        return undefined;
    }

    const latestPage = pages[0];

    if (!latestPage) {
        return undefined;
    }

    const rowsById = new Map<string, ChatLogPage['rows'][number]>();

    // Oldest page first so rows stay in timeline order and newer pages win
    // on id collisions.
    for (let index = pages.length - 1; index >= 0; index -= 1) {
        for (const row of pages[index]?.rows ?? []) {
            rowsById.set(row.id, row);
        }
    }

    return {
        ...latestPage,
        limit: rowsById.size,
        nextBeforeSequence: pages.at(-1)?.nextBeforeSequence ?? latestPage.nextBeforeSequence,
        rows: [...rowsById.values()],
    };
}
