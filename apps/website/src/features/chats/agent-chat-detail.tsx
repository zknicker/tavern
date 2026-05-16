import * as React from 'react';
import { flushSync } from 'react-dom';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { resolveTavernChatName } from '../../components/chats/chat-display.ts';
import { useAgentList } from '../../hooks/agents/use-agent-list.ts';
import { createChatStartTiming } from '../../hooks/chats/chat-start-timing.ts';
import { getChatDraftRouteState } from '../../hooks/chats/use-chat-draft-launch.ts';
import { useChatList } from '../../hooks/chats/use-chat-list.ts';
import { useChatStartDrafts } from '../../hooks/chats/use-chat-start-drafts.tsx';
import { useChatStatus } from '../../hooks/chats/use-chat-status.ts';
import { useChatTimeline } from '../../hooks/chats/use-chat-timeline.ts';
import { useChatTimelineStore } from '../../hooks/chats/use-chat-timeline-store.tsx';
import { useTimelineContext } from '../../hooks/chats/use-timeline-context.tsx';
import { useModelList } from '../../hooks/models/use-model-list.ts';
import { trpc } from '../../lib/trpc.tsx';
import { MissingAgentState } from '../agents/missing-agent-state.tsx';
import { getChatContextFullness } from './chat-context-fullness.ts';
import { ChatDetailFrame } from './chat-detail-frame.tsx';
import { ChatDraftDetail } from './chat-draft-detail.tsx';
import { buildChatList } from './chat-list-data.ts';
import { ChatMessageComposer } from './chat-message-composer.tsx';
import { getChatMessageLayout } from './chat-message-layout.ts';
import { buildChatPath } from './chat-path.ts';

const chatDetailLogLimit = 100;

export function AgentChatDetail({ chatId }: { chatId: string }) {
    const location = useLocation();
    const navigate = useNavigate();
    const routeState = getChatDraftRouteState(location.state);
    const chatQuery = useChatList();
    const drafts = useChatStartDrafts();
    const routeDraft = drafts.getDraft(routeState?.draftChatId);
    const startChat = trpc.chat.start.useMutation();
    const timelineStore = useChatTimelineStore();
    const timelineState = useTimelineContext();
    const utils = trpc.useUtils();
    const startedDraftRef = React.useRef<string | null>(null);
    const [releasedDraftId, setReleasedDraftId] = React.useState<string | null>(null);
    const chats = React.useMemo(
        () => buildChatList(chatQuery.data?.chats ?? []),
        [chatQuery.data?.chats]
    );
    const chat = chats.find((entry) => entry.id === chatId) ?? null;
    const reconciledDraft = drafts.getReconciledDraft(chatId);

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

                void utils.chat.list
                    .invalidate()
                    .then(() => {
                        logTiming('client.invalidateChatList', { chatId: started.chatId });
                    })
                    .catch(() => {
                        logTiming('client.chatListRefreshFailed', { chatId: started.chatId });
                    });

                navigate(buildChatPath(started.chatId), {
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
        utils.chat.list,
    ]);

    React.useEffect(() => {
        if (routeDraft?.realChatId !== chatId || !chat) {
            return;
        }

        const handoffState = timelineState.timelineStates[chatId];
        if (!shouldReleaseDraftHandoff(handoffState)) {
            return;
        }

        let frame = 0;
        let cancelled = false;
        const release = () => {
            if (cancelled) {
                return;
            }

            frame += 1;

            if (frame < 2) {
                requestAnimationFrame(release);
                return;
            }

            setReleasedDraftId(routeDraft.id);
        };

        requestAnimationFrame(release);

        return () => {
            cancelled = true;
        };
    }, [chat, chatId, routeDraft, timelineState.timelineStates]);

    if (chatId === 'new') {
        if (!routeDraft) {
            return <Navigate replace to="/dashboard/chats" />;
        }

        return <ChatDraftDetail draft={routeDraft} timelineChatId={routeDraft.id} />;
    }

    if (routeDraft?.realChatId === chatId && releasedDraftId !== routeDraft.id) {
        return (
            <ChatDraftDetail animateTimeline={false} draft={routeDraft} timelineChatId={chatId} />
        );
    }

    if (!chat) {
        if (reconciledDraft) {
            return (
                <ChatDraftDetail
                    animateTimeline={false}
                    draft={reconciledDraft}
                    timelineChatId={chatId}
                />
            );
        }

        if (chatQuery.isPending) {
            return <ChatDraftDetail draft={null} timelineChatId={chatId} />;
        }

        return <Navigate replace to="/dashboard/chats" />;
    }

    return (
        <SyncedAgentChatDetail
            animateTimeline={shouldAnimateSyncedChatTimeline({
                chatId,
                draftRealChatId: routeDraft?.realChatId ?? null,
            })}
            chat={chat}
            chatId={chatId}
        />
    );
}

export function shouldAnimateSyncedChatTimeline({
    chatId,
    draftRealChatId,
}: {
    chatId: string;
    draftRealChatId: string | null;
}) {
    return draftRealChatId !== chatId;
}

export function shouldReleaseDraftHandoff(
    state: ReturnType<typeof useTimelineContext>['timelineStates'][string] | undefined
) {
    if (!state) {
        return false;
    }

    if (state.failedTurn) {
        return true;
    }

    if (!state.activeReply) {
        return state.historyLoaded;
    }

    return (state.activeReply.text ?? '').trim().length > 0;
}

export function isBlockingActiveReply(input: {
    activeReply: { isThinking?: boolean | null } | null;
    agentsPending: boolean;
}) {
    if (input.agentsPending) {
        return true;
    }

    return input.activeReply?.isThinking !== false && input.activeReply !== null;
}

function SyncedAgentChatDetail({
    animateTimeline,
    chat,
    chatId,
}: {
    animateTimeline: boolean;
    chat: ReturnType<typeof buildChatList>[number];
    chatId: string;
}) {
    const agentsQuery = useAgentList();
    const chatStatusQuery = useChatStatus();
    const modelsQuery = useModelList();
    const agentId = resolveChatAgentId(chat);
    const agents = agentsQuery.data?.agents ?? [];
    const agent = agents.find((entry) => entry.id === agentId) ?? null;
    const chatStatus = chatStatusQuery.data?.chats.find((entry) => entry.chatId === chatId) ?? null;
    const conversationLayout = getChatMessageLayout(chat);
    const timeline = useChatTimeline({
        activeReply: chatStatus?.activeReply ?? null,
        activeReplyProgressStartedAt: chatStatus?.activeReplyProgressStartedAt ?? null,
        activeReplySteps: chatStatus?.activeReplySteps ?? [],
        chatId,
        limit: chatDetailLogLimit,
    });
    const rows = timeline.rows;
    const totalRows = timeline.totalRows;
    const contextFullness = modelsQuery.data
        ? getChatContextFullness({
              models: modelsQuery.data.models,
              rows,
          })
        : null;

    if (!(agent || agentsQuery.isPending)) {
        return <MissingAgentState agentId={agentId} />;
    }

    return (
        <ChatDetailFrame
            activeReply={timeline.activeReply}
            activeReplyProgressStartedAt={timeline.activeReplyProgressStartedAt}
            activeReplySteps={timeline.activeReplySteps}
            animateTimeline={animateTimeline}
            completedProgress={timeline.completedProgress}
            conversationLayout={conversationLayout}
            emptyLabel="No synced messages for this chat yet."
            error={timeline.error}
            failedTurn={timeline.failedTurn}
            footer={
                <ChatMessageComposer
                    agents={agents}
                    chat={chat}
                    contextFullness={contextFullness}
                    isReplyActive={isBlockingActiveReply({
                        activeReply: timeline.activeReply,
                        agentsPending: agentsQuery.isPending,
                    })}
                />
            }
            historyLoaded={timeline.historyLoaded}
            isPending={timeline.isPending}
            rows={rows}
            title={getBreadcrumbChatTitle(chat)}
            totalRows={totalRows}
        />
    );
}

function resolveChatAgentId(chat: ReturnType<typeof buildChatList>[number] | null) {
    return chat?.latestSession?.agentId ?? chat?.boundAgentIds[0] ?? '';
}

function getBreadcrumbChatTitle(chat: ReturnType<typeof buildChatList>[number]) {
    return chat.type === 'tavern' ? resolveTavernChatName(chat) : chat.title;
}
