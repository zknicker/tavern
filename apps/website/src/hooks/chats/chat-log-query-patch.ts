import type { InfiniteData, QueryClient } from '@tanstack/react-query';
import { getQueryKey } from '@trpc/react-query';
import type { ChatLogOutput } from '../../lib/trpc.tsx';
import { trpc } from '../../lib/trpc.tsx';
import { patchInfiniteChatLogWithProgress } from './chat-log-infinite-cache.ts';

/**
 * Applies an updater to every live chat.log.list cache entry for one chat —
 * both the plain query shape and the infinite shape. Live means the
 * head-of-timeline query (no offset); paged history reads are left alone.
 */
export function patchLiveChatLogQueries(
    queryClient: QueryClient,
    chatId: string,
    updater: (current: ChatLogOutput | undefined) => ChatLogOutput | undefined
) {
    let matchedQuery = false;

    queryClient.setQueriesData<ChatLogOutput>(
        {
            exact: false,
            predicate: (query) => isLiveChatLogQuery(query.queryKey, chatId),
            queryKey: getQueryKey(trpc.chat.log.list, undefined, 'query'),
        },
        (current) => {
            matchedQuery = true;
            return updater(current);
        }
    );

    if (matchedQuery) {
        return;
    }

    queryClient.setQueriesData<InfiniteData<NonNullable<ChatLogOutput>>>(
        {
            exact: false,
            predicate: (query) => isLiveChatLogQuery(query.queryKey, chatId),
            queryKey: getQueryKey(trpc.chat.log.list, undefined, 'infinite'),
        },
        (current) => patchInfiniteChatLogWithProgress(current, updater)
    );
}

export function isLiveChatLogQuery(queryKey: readonly unknown[], chatId: string) {
    const input = readChatLogQueryInput(queryKey);

    return input?.id === chatId && input.offset === undefined;
}

function readChatLogQueryInput(queryKey: readonly unknown[]) {
    const metadata = queryKey[1];

    if (!(metadata && typeof metadata === 'object' && 'input' in metadata)) {
        return null;
    }

    const input = metadata.input;

    if (!(input && typeof input === 'object' && 'id' in input)) {
        return null;
    }

    return input as { id?: string; offset?: number };
}
