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

    // Pages are ordered newest-first; live progress patches the newest page.
    return {
        ...current,
        pages: current.pages.map((page, index) => {
            if (index !== 0) {
                return page;
            }

            return updater(page) ?? page;
        }),
    };
}
