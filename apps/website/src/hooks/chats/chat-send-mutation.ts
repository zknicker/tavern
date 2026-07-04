import { parseAgentReferenceTarget, parseTavernRichReferences } from '@tavern/api/rich-references';
import type { ChatMessageAttachmentInput } from '../../lib/trpc.tsx';
import { createChatRunId } from './chat-run-id.ts';

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
        }) => {
            const timestamp = new Date().toISOString();
            const timelineMessageId = input.clientMessageId ?? `msg_${crypto.randomUUID()}`;
            const optimisticRunId = createChatRunId(timelineMessageId);
            utils.timelineMessage.add({
                ...(input.attachments?.length ? { attachments: input.attachments } : {}),
                chatId: input.chatId,
                content: input.content,
                id: timelineMessageId,
                timestamp,
            });

            for (const agentId of inputAgentIds(input)) {
                utils.timelineTurn.start({
                    agentId,
                    chatId: input.chatId,
                    runId: optimisticRunId,
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
                runId: createChatRunId(context.timelineMessageId),
            });
        },
        onSuccess: async (
            result: {
                acceptedAt: string;
                chatId: string;
                turns: Array<{
                    agentId: string;
                    runId: string;
                }>;
            },
            _input: unknown,
            context: ChatSendMutationContext | undefined
        ) => {
            const firstTurn = result.turns[0] ?? null;
            const turnReference = firstTurn?.runId ?? null;

            if (context && turnReference) {
                utils.timelineMessage.setSession({
                    chatId: result.chatId,
                    messageId: context.timelineMessageId,
                    sessionKey: turnReference,
                });
            }

            for (const turn of result.turns) {
                utils.timelineTurn.start({
                    agentId: turn.agentId,
                    chatId: result.chatId,
                    runId: turn.runId,
                    sessionKey: turn.runId,
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

function inputAgentIds(input: { agentId?: string; content: string }) {
    if (input.agentId) {
        return [input.agentId];
    }

    return [
        ...new Set(
            parseTavernRichReferences(input.content).flatMap((reference) => {
                if (reference.kind !== 'agent') {
                    return [];
                }

                const agentId = parseAgentReferenceTarget(reference.id);
                return agentId ? [agentId] : [];
            })
        ),
    ];
}
