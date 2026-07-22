import { parseAgentReferenceTarget, parseTavernRichReferences } from '@tavern/api/rich-references';
import type { ChatMessageAttachmentInput } from '../../lib/trpc.tsx';
import { createChatRunId } from './chat-run-id.ts';

export interface ChatSendMutationContext {
    optimisticRunIds: string[];
    timelineChatId: string | null;
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
            thread?: { anchorMessageId: string };
        }) => {
            const timestamp = new Date().toISOString();
            const timelineMessageId = input.clientMessageId ?? `msg_${crypto.randomUUID()}`;
            if (input.thread) {
                return {
                    optimisticRunIds: [],
                    timelineChatId: null,
                    timelineMessageId,
                } satisfies ChatSendMutationContext;
            }

            utils.timelineMessage.add({
                ...(input.attachments?.length ? { attachments: input.attachments } : {}),
                chatId: input.chatId,
                content: input.content,
                id: timelineMessageId,
                timestamp,
            });

            // One optimistic run per agent seat, under the run id the runtime
            // will mint for this (message, agent) pair — the real turn events
            // then update these replies in place instead of appearing beside
            // them as duplicates.
            const optimisticRunIds = inputAgentIds(input).map((agentId) => {
                const runId = createChatRunId(timelineMessageId, agentId);

                utils.timelineTurn.start({
                    agentId,
                    chatId: input.chatId,
                    runId,
                    sessionKey: '',
                    startedAt: timestamp,
                });

                return runId;
            });

            return {
                optimisticRunIds,
                timelineChatId: input.chatId,
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

            if (context.timelineChatId) {
                utils.timelineMessage.remove({
                    chatId: context.timelineChatId,
                    messageId: context.timelineMessageId,
                });
            }

            for (const runId of context.optimisticRunIds) {
                utils.timelineTurn.clear({
                    chatId: input.chatId,
                    runId,
                });
            }
        },
        onSuccess: async (
            result: {
                acceptedAt: string;
                chatId: string;
                turns: Array<{
                    agentId: string;
                    runId: string;
                }>;
                threadChatId?: string | null;
            },
            _input: unknown,
            context: ChatSendMutationContext | undefined
        ) => {
            const firstTurn = result.turns[0] ?? null;
            const turnReference = firstTurn?.runId ?? null;

            if (context?.timelineChatId && turnReference) {
                utils.timelineMessage.setSession({
                    chatId: context.timelineChatId,
                    messageId: context.timelineMessageId,
                    sessionKey: turnReference,
                });
            }

            // Optimistic runs the server did not accept (or minted under a
            // different id) must not linger as ghost thinking indicators.
            const acceptedRunIds = new Set(result.turns.map((turn) => turn.runId));

            for (const runId of context?.optimisticRunIds ?? []) {
                if (!acceptedRunIds.has(runId)) {
                    utils.timelineTurn.clear({ chatId: result.chatId, runId });
                }
            }

            if (context?.timelineChatId) {
                for (const turn of result.turns) {
                    utils.timelineTurn.start({
                        agentId: turn.agentId,
                        chatId: context.timelineChatId,
                        runId: turn.runId,
                        sessionKey: turn.runId,
                        startedAt: result.acceptedAt,
                    });
                }
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
