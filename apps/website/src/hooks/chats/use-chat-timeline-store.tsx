import type { PropsWithChildren } from 'react';
import * as React from 'react';
import type { ChatLogOutput } from '../../lib/trpc.tsx';
import {
    addChatTimelineMessage,
    type ChatTimelineLocalMessagesState,
    emptyChatTimelineLocalMessagesState,
    moveChatTimelineMessages,
    removeChatTimelineMessages,
    selectChatTimelineMessages,
    setChatTimelineMessageSession,
} from './chat-timeline-local-messages.ts';
import {
    type ChatTimelineMessage,
    getLoggedTimelineMessageIds,
    mergeTimelineMessages,
} from './chat-timeline-messages.ts';

interface ChatTimelineStoreValue {
    addMessage: (input: { chatId: string } & ChatTimelineMessage) => void;
    localMessages: ChatTimelineLocalMessagesState;
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
    const [localMessages, setLocalMessages] = React.useState<ChatTimelineLocalMessagesState>(
        emptyChatTimelineLocalMessagesState
    );

    const addMessage = React.useCallback((input: { chatId: string } & ChatTimelineMessage) => {
        setLocalMessages((current) => addChatTimelineMessage(current, input));
    }, []);

    const moveMessages = React.useCallback((input: { fromChatId: string; toChatId: string }) => {
        setLocalMessages((current) => moveChatTimelineMessages(current, input));
    }, []);

    const setMessageSession = React.useCallback(
        (input: { chatId: string; messageId: string; sessionKey?: string | null }) => {
            setLocalMessages((current) => setChatTimelineMessageSession(current, input));
        },
        []
    );

    const removeMessages = React.useCallback(
        (input: { chatId: string; messageIds: readonly string[] }) => {
            setLocalMessages((current) => removeChatTimelineMessages(current, input));
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
            localMessages,
            moveMessages,
            removeMessage,
            removeMessages,
        }),
        [addMessage, localMessages, moveMessages, removeMessage, removeMessages, setMessageSession]
    );

    return React.createElement(ChatTimelineContext.Provider, { value }, children);
}

export function useChatTimelineMessages(chatId: string) {
    const context = useChatTimelineStore();
    const messages = React.useMemo(
        () => selectChatTimelineMessages(context.localMessages, chatId),
        [chatId, context.localMessages]
    );

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
