import type { InfiniteData } from '@tanstack/react-query';
import type { ChatLogOutput } from '../../lib/trpc.tsx';

type ChatLogPage = NonNullable<ChatLogOutput>;

export function patchInfiniteChatLogWithProgress(
    current: InfiniteData<ChatLogPage> | undefined,
    updater: (current: ChatLogOutput | undefined) => ChatLogOutput | undefined
): InfiniteData<ChatLogPage> | undefined {
    if (!(current && current.pages.length > 0)) {
        return current;
    }

    const lastPageIndex = current.pages.length - 1;

    return {
        ...current,
        pages: current.pages.map((page, index) => {
            if (index !== lastPageIndex) {
                return page;
            }

            return updater(chatLogPageForLivePatch(page)) ?? page;
        }),
    };
}

// Live patches must only grow the loaded window. Trimming to the fetch limit
// here evicts loaded history rows while a turn streams, which visibly drains
// older expanded work drawers until the completion refetch restores them.
function chatLogPageForLivePatch(page: ChatLogPage): ChatLogPage {
    return {
        ...page,
        limit: Math.max(page.limit, page.rows.length + 1),
    };
}
