import type { ChatMessageAttachmentInput } from '../../lib/trpc.tsx';

export interface ChatSendMutationContext {
    timelineMessageId: string;
}

export interface ChatSendMutationUtils {
    chat: {
        get: {
            invalidate: (input: { chatId: string }) => Promise<unknown>;
        };
        list: {
            invalidate: () => Promise<unknown>;
        };
        log: {
            list: {
                invalidate: () => Promise<unknown>;
            };
        };
    };
    session: {
        get: {
            invalidate: () => Promise<unknown>;
        };
        history: {
            get: {
                invalidate: () => Promise<unknown>;
            };
        };
        list: {
            invalidate: () => Promise<unknown>;
        };
    };
    timelineMessage: {
        add: (input: {
            attachments?: ChatMessageAttachmentInput[];
            chatId: string;
            content: string;
            id: string;
            metadata?: Record<string, unknown>;
            timestamp: string;
        }) => void;
        setSession: (input: {
            chatId: string;
            messageId: string;
            sessionKey?: string | null;
        }) => void;
        remove: (input: { chatId: string; messageId: string }) => void;
    };
    timelineTurn: {
        clear: (input: { chatId: string; runId?: string }) => void;
        start: (input: {
            agentId: string;
            chatId: string;
            runId: string;
            sessionKey: string;
            startedAt: string;
        }) => void;
    };
}

export function createChatSendMutationHandlers(utils: ChatSendMutationUtils) {
    return {
        onMutate: async (input: {
            agentId?: string;
            attachments?: ChatMessageAttachmentInput[];
            chatId: string;
            clientMessageId?: string;
            content: string;
            metadata?: Record<string, unknown>;
        }) => {
            const timestamp = new Date().toISOString();
            const timelineMessageId = input.clientMessageId ?? `msg_${crypto.randomUUID()}`;
            utils.timelineMessage.add({
                ...(input.attachments?.length ? { attachments: input.attachments } : {}),
                chatId: input.chatId,
                content: input.content,
                id: timelineMessageId,
                metadata: input.metadata,
                timestamp,
            });

            if (input.agentId) {
                utils.timelineTurn.start({
                    agentId: input.agentId,
                    chatId: input.chatId,
                    runId: `pending:${timelineMessageId}`,
                    sessionKey: '',
                    startedAt: timestamp,
                });
            }

            return {
                timelineMessageId,
            } satisfies ChatSendMutationContext;
        },
        onError: (
            _error: unknown,
            input: { chatId: string },
            context: ChatSendMutationContext | undefined
        ) => {
            if (!context) {
                return;
            }

            utils.timelineMessage.remove({
                chatId: input.chatId,
                messageId: context.timelineMessageId,
            });
            utils.timelineTurn.clear({
                chatId: input.chatId,
                runId: `pending:${context.timelineMessageId}`,
            });
        },
        onSuccess: async (
            result: {
                acceptedAt: string;
                chatId: string;
                runId: string;
                sessionKey?: string | null;
            },
            input: { agentId?: string },
            context: ChatSendMutationContext | undefined
        ) => {
            if (context) {
                utils.timelineMessage.setSession({
                    chatId: result.chatId,
                    messageId: context.timelineMessageId,
                    sessionKey: result.sessionKey ?? null,
                });
            }

            if (result.sessionKey && input.agentId) {
                utils.timelineTurn.start({
                    agentId: input.agentId,
                    chatId: result.chatId,
                    runId: result.runId,
                    sessionKey: result.sessionKey,
                    startedAt: result.acceptedAt,
                });
            }

            await Promise.all([
                utils.chat.get.invalidate({ chatId: result.chatId }),
                utils.chat.list.invalidate(),
                utils.chat.log.list.invalidate(),
                utils.session.list.invalidate(),
            ]);
        },
    };
}
