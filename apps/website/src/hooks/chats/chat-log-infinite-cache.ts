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

            return updater(page) ?? page;
        }),
    };
}
