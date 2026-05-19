import type { ChatTimelineMessage } from './chat-timeline-messages.ts';

export interface ChatTimelineLocalMessagesState {
    idsByChatId: Record<string, string[]>;
    messagesById: Record<string, ChatTimelineMessage>;
}

export const emptyChatTimelineLocalMessagesState: ChatTimelineLocalMessagesState = {
    idsByChatId: {},
    messagesById: {},
};

export function selectChatTimelineMessages(state: ChatTimelineLocalMessagesState, chatId: string) {
    return (state.idsByChatId[chatId] ?? []).flatMap((messageId) => {
        const message = state.messagesById[messageId];

        return message ? [message] : [];
    });
}

export function addChatTimelineMessage(
    state: ChatTimelineLocalMessagesState,
    input: { chatId: string } & ChatTimelineMessage
): ChatTimelineLocalMessagesState {
    const { chatId, ...message } = input;
    const idsWithoutMessage = Object.fromEntries(
        Object.entries(state.idsByChatId)
            .map(([entryChatId, ids]) => [
                entryChatId,
                ids.filter((messageId) => messageId !== message.id),
            ])
            .filter(([, ids]) => ids.length > 0)
    );

    return {
        idsByChatId: {
            ...idsWithoutMessage,
            [chatId]: [...(idsWithoutMessage[chatId] ?? []), message.id],
        },
        messagesById: {
            ...state.messagesById,
            [message.id]: message,
        },
    };
}

export function moveChatTimelineMessages(
    state: ChatTimelineLocalMessagesState,
    input: { fromChatId: string; toChatId: string }
): ChatTimelineLocalMessagesState {
    if (input.fromChatId === input.toChatId) {
        return state;
    }

    const movedIds = state.idsByChatId[input.fromChatId];

    if (!movedIds || movedIds.length === 0) {
        return state;
    }

    const movedIdSet = new Set(movedIds);
    const nextTargetIds = [
        ...(state.idsByChatId[input.toChatId] ?? []).filter(
            (messageId) => !movedIdSet.has(messageId)
        ),
        ...movedIds,
    ];
    const { [input.fromChatId]: _moved, ...restIdsByChatId } = state.idsByChatId;

    return {
        ...state,
        idsByChatId: {
            ...restIdsByChatId,
            [input.toChatId]: nextTargetIds,
        },
    };
}

export function setChatTimelineMessageSession(
    state: ChatTimelineLocalMessagesState,
    input: { chatId: string; messageId: string; sessionKey?: string | null }
): ChatTimelineLocalMessagesState {
    if (!state.idsByChatId[input.chatId]?.includes(input.messageId)) {
        return state;
    }

    const message = state.messagesById[input.messageId];

    if (!message || message.sessionKey === (input.sessionKey ?? null)) {
        return state;
    }

    return {
        ...state,
        messagesById: {
            ...state.messagesById,
            [input.messageId]: {
                ...message,
                sessionKey: input.sessionKey ?? null,
            },
        },
    };
}

export function removeChatTimelineMessages(
    state: ChatTimelineLocalMessagesState,
    input: { chatId: string; messageIds: readonly string[] }
): ChatTimelineLocalMessagesState {
    if (input.messageIds.length === 0) {
        return state;
    }

    const chatMessageIds = state.idsByChatId[input.chatId];

    if (!chatMessageIds) {
        return state;
    }

    const removedIds = new Set(input.messageIds);
    const nextChatMessageIds = chatMessageIds.filter((messageId) => !removedIds.has(messageId));

    if (nextChatMessageIds.length === chatMessageIds.length) {
        return state;
    }

    const nextMessagesById = { ...state.messagesById };

    for (const messageId of input.messageIds) {
        delete nextMessagesById[messageId];
    }

    if (nextChatMessageIds.length === 0) {
        const { [input.chatId]: _removed, ...restIdsByChatId } = state.idsByChatId;

        return {
            idsByChatId: restIdsByChatId,
            messagesById: nextMessagesById,
        };
    }

    return {
        idsByChatId: {
            ...state.idsByChatId,
            [input.chatId]: nextChatMessageIds,
        },
        messagesById: nextMessagesById,
    };
}
