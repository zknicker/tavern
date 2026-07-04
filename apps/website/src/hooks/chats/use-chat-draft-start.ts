import * as React from 'react';
import { flushSync } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { trpc } from '../../lib/trpc.tsx';
import { createChatStartTiming } from './chat-start-timing.ts';
import type { ChatStartDraft } from './use-chat-start-drafts.tsx';
import { useChatStartDrafts } from './use-chat-start-drafts.tsx';
import { useChatStartMessage } from './use-chat-start-message.ts';
import { useChatTimelineStore } from './use-chat-timeline-store.tsx';
import { useTimelineActions } from './use-timeline-context.tsx';

export function useChatDraftStart(input: {
    chatId: string;
    routeDraft: ChatStartDraft | null;
    toChatPath: (chatId: string) => string;
}) {
    const { chatId, routeDraft, toChatPath } = input;
    const navigate = useNavigate();
    const drafts = useChatStartDrafts();
    const startChat = useChatStartMessage();
    const timelineStore = useChatTimelineStore();
    const timelineState = useTimelineActions();
    const utils = trpc.useUtils();
    const startedDraftRef = React.useRef<string | null>(null);

    React.useEffect(() => {
        if (
            chatId !== 'new' ||
            !routeDraft ||
            startedDraftRef.current === routeDraft.id ||
            routeDraft.status !== 'queued'
        ) {
            return;
        }

        startedDraftRef.current = routeDraft.id;
        drafts.markCreating(routeDraft.id);

        const logTiming = createChatStartTiming('chat.start');

        startChat
            .mutateAsync({
                agentId: routeDraft.agentId,
                ...(routeDraft.attachments?.length ? { attachments: routeDraft.attachments } : {}),
                clientMessageId: routeDraft.clientMessageId,
                content: routeDraft.content,
            })
            .then((started) => {
                const firstTurn = started.turns[0] ?? null;
                const runId = firstTurn?.runId ?? routeDraft.clientMessageId;

                logTiming('client.startChat', { chatId: started.chatId });
                flushSync(() => {
                    drafts.reconcileDraft({
                        acceptedAt: started.acceptedAt,
                        chatId: started.chatId,
                        draftId: routeDraft.id,
                        runId,
                        turnReference: firstTurn?.runId ?? null,
                    });
                    timelineStore.moveMessages({
                        fromChatId: routeDraft.id,
                        toChatId: started.chatId,
                    });
                    timelineStore.setMessageSession({
                        chatId: started.chatId,
                        messageId: routeDraft.clientMessageId,
                        sessionKey: firstTurn?.runId ?? null,
                    });
                    if (firstTurn) {
                        timelineState.startTurn({
                            agentId: firstTurn.agentId,
                            chatId: started.chatId,
                            runId: firstTurn.runId,
                            sessionKey: firstTurn.runId,
                            startedAt: started.acceptedAt,
                        });
                    }
                });
                logTiming('client.sendMessageDispatched', { chatId: started.chatId });

                void Promise.all([
                    utils.chat.get.invalidate({ chatId: started.chatId }),
                    utils.chat.list.invalidate(),
                ])
                    .then(() => {
                        logTiming('client.invalidateChatList', { chatId: started.chatId });
                    })
                    .catch(() => {
                        logTiming('client.chatListRefreshFailed', { chatId: started.chatId });
                    });

                navigate(toChatPath(started.chatId), {
                    flushSync: true,
                    preventScrollReset: true,
                    replace: true,
                    state: {
                        draftChatId: routeDraft.id,
                    },
                });
            })
            .catch((error: unknown) => {
                logTiming('client.failed');
                drafts.failDraft({
                    draftId: routeDraft.id,
                    errorMessage: error instanceof Error ? error.message : 'Unable to start chat.',
                });
                startedDraftRef.current = null;
            });
    }, [
        chatId,
        drafts,
        navigate,
        routeDraft,
        startChat,
        timelineState,
        timelineStore,
        toChatPath,
        utils.chat.get,
        utils.chat.list,
    ]);
}
