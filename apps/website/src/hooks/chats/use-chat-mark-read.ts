import * as React from 'react';
import { trpc } from '../../lib/trpc.tsx';
import { useChatRuntimeTimelineState } from './use-timeline-context.tsx';

/**
 * Marks the open chat read (runtime read receipt at the newest message) on
 * open and whenever new messages land while it stays open. The sidebar's
 * unread pill zeroes optimistically; the next chat.list refetch reconciles.
 */
export function useMarkChatReadOnView(chatId: string, options: { enabled?: boolean } = {}) {
    const enabled = options.enabled ?? true;
    const timeline = useChatRuntimeTimelineState(chatId);
    const markRead = useMarkChatRead();
    const mutate = markRead.mutate;
    const lastMarkedRef = React.useRef<string | null>(null);
    const viewKey = buildChatReadViewKey({
        chatId,
        enabled,
        historyLoaded: timeline.historyLoaded,
        totalMessages: timeline.totalMessages,
    });

    React.useEffect(() => {
        if (!viewKey || lastMarkedRef.current === viewKey) {
            return;
        }
        lastMarkedRef.current = viewKey;
        mutate({ chatId });
    }, [chatId, mutate, viewKey]);
}

export function buildChatReadViewKey(input: {
    chatId: string;
    enabled: boolean;
    historyLoaded: boolean;
    totalMessages: number;
}) {
    return input.enabled && input.historyLoaded ? `${input.chatId}:${input.totalMessages}` : null;
}

function useMarkChatRead() {
    const utils = trpc.useUtils();

    return trpc.chat.markRead.useMutation({
        onMutate: ({ chatId }) => {
            utils.chat.list.setData(undefined, (current) => {
                const item = current?.itemsById[chatId];

                if (!(current && item) || item.unreadCount === 0) {
                    return current;
                }

                return {
                    ...current,
                    itemsById: {
                        ...current.itemsById,
                        [chatId]: { ...item, unreadCount: 0 },
                    },
                };
            });
        },
        // Parent unread includes followed child threads. A parent receipt can
        // clear only the parent portion, so restore the authoritative rollup.
        onSettled: () => {
            void utils.chat.list.invalidate();
        },
    });
}
