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
                clientMessageId: routeDraft.clientMessageId,
                content: routeDraft.content,
                metadata: routeDraft.metadata,
            })
            .then((started) => {
                logTiming('client.startChat', { chatId: started.chatId });
                flushSync(() => {
                    drafts.reconcileDraft({
                        acceptedAt: started.acceptedAt,
                        chatId: started.chatId,
                        draftId: routeDraft.id,
                        runId: started.runId,
                        sessionKey: started.sessionKey,
                    });
                    timelineStore.moveMessages({
                        fromChatId: routeDraft.id,
                        toChatId: started.chatId,
                    });
                    timelineStore.setMessageSession({
                        chatId: started.chatId,
                        messageId: routeDraft.clientMessageId,
                        sessionKey: started.sessionKey,
                    });
                    if (started.sessionKey) {
                        timelineState.startTurn({
                            agentId: routeDraft.agentId,
                            chatId: started.chatId,
                            runId: started.runId,
                            sessionKey: started.sessionKey,
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
