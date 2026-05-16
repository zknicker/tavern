import { trpc } from '../../lib/trpc.tsx';
import { createChatSendMutationHandlers } from './chat-send-mutation.ts';
import { useChatTimelineStore } from './use-chat-timeline-store.tsx';
import { useTimelineContext } from './use-timeline-context.tsx';

export function useChatSend() {
    const utils = trpc.useUtils();
    const timeline = useChatTimelineStore();
    const timelineState = useTimelineContext();

    return trpc.chat.send.useMutation(
        createChatSendMutationHandlers({
            chat: utils.chat,
            timelineMessage: {
                add: ({ chatId, ...input }) => {
                    timeline.addMessage({
                        ...input,
                        chatId,
                    });
                },
                setSession: ({ chatId, messageId, sessionKey }) => {
                    timeline.setMessageSession({
                        chatId,
                        messageId,
                        sessionKey,
                    });
                },
                remove: ({ chatId, messageId }) => {
                    timeline.removeMessage({
                        chatId,
                        messageId,
                    });
                },
            },
            timelineTurn: {
                clear: timelineState.clearTurn,
                start: timelineState.startTurn,
            },
            session: utils.session,
        })
    );
}
