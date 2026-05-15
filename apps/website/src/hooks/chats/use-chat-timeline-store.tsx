import type { PropsWithChildren } from 'react';
import * as React from 'react';
import type { ChatLogOutput } from '../../lib/trpc.tsx';
import {
    type ChatTimelineMessage,
    getLoggedTimelineMessageIds,
    mergeTimelineMessages,
} from './chat-timeline-messages.ts';

interface ChatTimelineStoreValue {
    addMessage: (input: { chatId: string } & ChatTimelineMessage) => void;
    messagesByChatId: Record<string, ChatTimelineMessage[]>;
    moveMessages: (input: { fromChatId: string; toChatId: string }) => void;
    removeMessage: (input: { chatId: string; messageId: string }) => void;
    removeMessages: (input: { chatId: string; messageIds: readonly string[] }) => void;
    setMessageSession: (input: {
        chatId: string;
        messageId: string;
        sessionKey?: string | null;
    }) => void;
}

const ChatTimelineContext = React.createContext<ChatTimelineStoreValue | null>(null);

export function ChatTimelineProvider({ children }: PropsWithChildren) {
    const [messagesByChatId, setMessagesByChatId] = React.useState<
        Record<string, ChatTimelineMessage[]>
    >({});

    const addMessage = React.useCallback((input: { chatId: string } & ChatTimelineMessage) => {
        const { chatId, ...message } = input;

        setMessagesByChatId((current) => ({
            ...current,
            [chatId]: [
                ...(current[chatId] ?? []).filter((entry) => entry.id !== message.id),
                message,
            ],
        }));
    }, []);

    const moveMessages = React.useCallback((input: { fromChatId: string; toChatId: string }) => {
        if (input.fromChatId === input.toChatId) {
            return;
        }

        setMessagesByChatId((current) => {
            const movedMessages = current[input.fromChatId];

            if (!movedMessages || movedMessages.length === 0) {
                return current;
            }

            const movedIds = new Set(movedMessages.map((message) => message.id));
            const nextTargetMessages = [
                ...(current[input.toChatId] ?? []).filter((message) => !movedIds.has(message.id)),
                ...movedMessages,
            ];
            const { [input.fromChatId]: _moved, ...rest } = current;

            return {
                ...rest,
                [input.toChatId]: nextTargetMessages,
            };
        });
    }, []);

    const setMessageSession = React.useCallback(
        (input: { chatId: string; messageId: string; sessionKey?: string | null }) => {
            setMessagesByChatId((current) => {
                const chatMessages = current[input.chatId];

                if (!chatMessages) {
                    return current;
                }

                return {
                    ...current,
                    [input.chatId]: chatMessages.map((message) =>
                        message.id === input.messageId
                            ? {
                                  ...message,
                                  sessionKey: input.sessionKey ?? null,
                              }
                            : message
                    ),
                };
            });
        },
        []
    );

    const removeMessages = React.useCallback(
        (input: { chatId: string; messageIds: readonly string[] }) => {
            if (input.messageIds.length === 0) {
                return;
            }

            setMessagesByChatId((current) => {
                const chatMessages = current[input.chatId];

                if (!chatMessages) {
                    return current;
                }

                const ids = new Set(input.messageIds);
                const nextChatMessages = chatMessages.filter((message) => !ids.has(message.id));

                if (nextChatMessages.length === chatMessages.length) {
                    return current;
                }

                if (nextChatMessages.length === 0) {
                    const { [input.chatId]: _removed, ...rest } = current;
                    return rest;
                }

                return {
                    ...current,
                    [input.chatId]: nextChatMessages,
                };
            });
        },
        []
    );

    const removeMessage = React.useCallback(
        (input: { chatId: string; messageId: string }) => {
            removeMessages({
                chatId: input.chatId,
                messageIds: [input.messageId],
            });
        },
        [removeMessages]
    );

    const value = React.useMemo<ChatTimelineStoreValue>(
        () => ({
            addMessage,
            setMessageSession,
            messagesByChatId,
            moveMessages,
            removeMessage,
            removeMessages,
        }),
        [
            addMessage,
            messagesByChatId,
            moveMessages,
            removeMessage,
            removeMessages,
            setMessageSession,
        ]
    );

    return React.createElement(ChatTimelineContext.Provider, { value }, children);
}

export function useChatTimelineMessages(chatId: string) {
    const context = useChatTimelineStore();
    const messages = context.messagesByChatId[chatId] ?? [];

    return {
        addMessage: (input: ChatTimelineMessage) => {
            context.addMessage({
                ...input,
                chatId,
            });
        },
        setMessageSession: (input: { messageId: string; sessionKey?: string | null }) => {
            context.setMessageSession({
                ...input,
                chatId,
            });
        },
        messages,
        removeMessage: (messageId: string) => {
            context.removeMessage({
                chatId,
                messageId,
            });
        },
        removeMessages: (messageIds: readonly string[]) => {
            context.removeMessages({
                chatId,
                messageIds,
            });
        },
    };
}

export function useChatTimelineStore() {
    const context = React.useContext(ChatTimelineContext);

    if (context === null) {
        throw new Error('useChatTimelineStore must be used within a ChatTimelineProvider.');
    }

    return context;
}

export function useChatTimelineRows(input: {
    chatId: string;
    limit: number;
    logged: ChatLogOutput | undefined;
    offset?: number;
}) {
    const { messages, removeMessages } = useChatTimelineMessages(input.chatId);
    const confirmedIds = React.useMemo(
        () =>
            input.offset === undefined ? getLoggedTimelineMessageIds(input.logged, messages) : [],
        [input.logged, input.offset, messages]
    );
    const localMessages = React.useMemo(() => {
        if (confirmedIds.length === 0) {
            return messages;
        }

        const confirmedIdsSet = new Set(confirmedIds);

        return messages.filter((message) => !confirmedIdsSet.has(message.id));
    }, [confirmedIds, messages]);

    React.useEffect(() => {
        if (confirmedIds.length === 0) {
            return;
        }

        removeMessages(confirmedIds);
    }, [confirmedIds, removeMessages]);

    return React.useMemo(() => {
        if (input.offset !== undefined) {
            return input.logged;
        }

        return mergeTimelineMessages({
            limit: input.limit,
            logged: input.logged,
            messages: localMessages,
        });
    }, [input.limit, input.logged, input.offset, localMessages]);
}
