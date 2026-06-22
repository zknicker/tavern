import type { ChatLogSteerNoticeSnapshot } from './chat-log-cache.ts';

export interface ChatSteerMutationContext {
    content: string;
    previousNotice: ChatSteerNoticeSnapshots;
    runId: string;
}

export interface ChatSteerNoticeSnapshots {
    liveLog: ChatLogSteerNoticeSnapshot | null;
    timeline: ChatLogSteerNoticeSnapshot | null;
}

export interface ChatSteerMutationUtils {
    chat: {
        get: {
            invalidate: (input: { chatId: string }) => Promise<unknown>;
        };
        log: {
            list: {
                invalidate: (input: { id: string }) => Promise<unknown>;
            };
        };
    };
    rollbackSteerNotice: (input: {
        chatId: string;
        content: string;
        previousNotice: ChatSteerNoticeSnapshots;
        runId: string;
    }) => void;
    session: {
        list: {
            invalidate: () => Promise<unknown>;
        };
    };
    showSteerNotice: (input: {
        chatId: string;
        content: string;
        runId: string;
        timestamp: string;
    }) => ChatSteerNoticeSnapshots;
}

export function createChatSteerMutationHandlers(utils: ChatSteerMutationUtils) {
    return {
        onMutate: async (input: { chatId: string; content: string; runId: string }) => {
            const previousNotice = utils.showSteerNotice({
                chatId: input.chatId,
                content: input.content,
                runId: input.runId,
                timestamp: new Date().toISOString(),
            });

            return {
                content: input.content,
                previousNotice,
                runId: input.runId,
            } satisfies ChatSteerMutationContext;
        },
        onError: (
            _error: unknown,
            input: { chatId: string },
            context: ChatSteerMutationContext | undefined
        ) => {
            if (!context) {
                return;
            }

            utils.rollbackSteerNotice({
                chatId: input.chatId,
                content: context.content,
                previousNotice: context.previousNotice,
                runId: context.runId,
            });
        },
        onSuccess: async (
            result: { steered: boolean },
            input: { chatId: string },
            context: ChatSteerMutationContext | undefined
        ) => {
            if (!result.steered && context) {
                utils.rollbackSteerNotice({
                    chatId: input.chatId,
                    content: context.content,
                    previousNotice: context.previousNotice,
                    runId: context.runId,
                });
            }

            await Promise.all([
                utils.chat.get.invalidate({ chatId: input.chatId }),
                utils.chat.log.list.invalidate({ id: input.chatId }),
                utils.session.list.invalidate(),
            ]);
        },
    };
}
