import * as React from 'react';
import { trpc } from '../../lib/trpc.tsx';
import { createChatStartTiming } from './chat-start-timing.ts';
import { buildStartedChatDisplayName } from './chat-start-title.ts';
import { useChatSend } from './use-chat-send.ts';

interface StartChatInput {
    agentId?: string;
    content: string;
}

export function useChatStart() {
    const utils = trpc.useUtils();
    const createChat = trpc.chat.create.useMutation();
    const sendMessage = useChatSend();
    const [startError, setStartError] = React.useState<Error | null>(null);

    const mutateAsync = React.useCallback(
        async (input: StartChatInput) => {
            setStartError(null);
            const logTiming = createChatStartTiming('chat.start');

            try {
                const created = await createChat.mutateAsync({
                    agentIds: input.agentId ? [input.agentId] : undefined,
                    displayName: buildStartedChatDisplayName(input.content),
                });
                logTiming('client.createChat', { chatId: created.chatId });

                sendMessage.mutate({
                    chatId: created.chatId,
                    clientMessageId: `msg_${crypto.randomUUID()}`,
                    content: input.content,
                });
                logTiming('client.sendMessageDispatched', { chatId: created.chatId });
                void utils.chat.list
                    .invalidate()
                    .then(() => {
                        logTiming('client.invalidateChatList', { chatId: created.chatId });
                    })
                    .catch(() => {
                        logTiming('client.chatListRefreshFailed', { chatId: created.chatId });
                    });

                return created;
            } catch (error) {
                logTiming('client.failed');
                const nextError =
                    error instanceof Error ? error : new Error('Unable to start chat.');
                setStartError(nextError);
                throw nextError;
            }
        },
        [createChat, sendMessage, utils.chat.list]
    );

    return {
        error: startError ?? createChat.error,
        isPending: createChat.isPending,
        mutateAsync,
    };
}
