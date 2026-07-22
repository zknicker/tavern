import * as React from 'react';
import { trpc } from '../../lib/trpc.tsx';
import { useChatRuntimeTimelineState } from '../chats/use-timeline-context.tsx';

/**
 * Marks the open thread read like a chat, then refreshes the parent chat's
 * log: the anchor's reply pill carries this reader's thread unread count, so
 * a read receipt written for the thread must invalidate the parent's rows.
 */
export function useMarkThreadReadOnView(input: {
    enabled?: boolean;
    parentChatId: string;
    threadChatId: string;
}) {
    const timeline = useChatRuntimeTimelineState(input.threadChatId);
    const utils = trpc.useUtils();
    const markRead = trpc.chat.markRead.useMutation({
        onSuccess: () => {
            void utils.chat.log.list.invalidate({ id: input.parentChatId });
            void utils.chat.list.invalidate();
        },
    });
    const mutate = markRead.mutate;
    const lastMarkedRef = React.useRef<null | string>(null);
    const viewKey =
        (input.enabled ?? true) && timeline.historyLoaded
            ? `${input.threadChatId}:${timeline.totalMessages}`
            : null;

    React.useEffect(() => {
        if (!viewKey || lastMarkedRef.current === viewKey) {
            return;
        }
        lastMarkedRef.current = viewKey;
        mutate({ chatId: input.threadChatId });
    }, [input.threadChatId, mutate, viewKey]);
}
