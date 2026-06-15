import * as React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAgentList } from '../../hooks/agents/use-agent-list.ts';
import type { ChatTimelineState } from '../../hooks/chats/chat-timeline-state.ts';
import { getChatDraftRouteState } from '../../hooks/chats/use-chat-draft-launch.ts';
import { useChatDraftStart } from '../../hooks/chats/use-chat-draft-start.ts';
import { useChatGet } from '../../hooks/chats/use-chat-list.ts';
import { useChatStartDrafts } from '../../hooks/chats/use-chat-start-drafts.tsx';
import { useChatTimeline } from '../../hooks/chats/use-chat-timeline.ts';
import { useChatVirtualizationPreference } from '../../hooks/chats/use-chat-virtualization-preference.ts';
import { useChatRuntimeTimelineState } from '../../hooks/chats/use-timeline-context.tsx';
import { useModelList } from '../../hooks/models/use-model-list.ts';
import { MissingAgentState } from '../agents/missing-agent-state.tsx';
import { getChatContextFullness } from './chat-context-fullness.ts';
import { ChatDetailFrame } from './chat-detail-frame.tsx';
import { ChatDraftDetail } from './chat-draft-detail.tsx';
import { buildChatListItem, type ChatListItem } from './chat-list-data.ts';
import { ChatMessageComposer } from './chat-message-composer.tsx';
import { getChatMessageLayout } from './chat-message-layout.ts';
import { buildChatPath } from './chat-path.ts';
import { getSteerableRunId } from './chat-steering.ts';

const chatDetailLogLimit = 100;

export function AgentChatDetail({ chatId }: { chatId: string }) {
    const location = useLocation();
    const routeState = getChatDraftRouteState(location.state);
    const chatQuery = useChatGet({ chatId });
    const drafts = useChatStartDrafts();
    const routeDraft = drafts.getDraft(routeState?.draftChatId);
    const handoffState = useChatRuntimeTimelineState(chatId);
    const [releasedDraftId, setReleasedDraftId] = React.useState<string | null>(null);
    const chat = React.useMemo(
        () => (chatQuery.data ? buildChatListItem(chatQuery.data) : null),
        [chatQuery.data]
    );
    const reconciledDraft = drafts.getReconciledDraft(chatId);

    useChatDraftStart({
        chatId,
        routeDraft,
        toChatPath: buildChatPath,
    });

    React.useEffect(() => {
        if (routeDraft?.realChatId !== chatId || !chat) {
            return;
        }

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
    }, [chat, chatId, handoffState, routeDraft]);

    if (chatId === 'new') {
        if (!routeDraft) {
            return <Navigate replace to="/dashboard/overview" />;
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

        return <Navigate replace to="/dashboard/overview" />;
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

export function shouldReleaseDraftHandoff(state: ChatTimelineState | undefined) {
    if (!state) {
        return false;
    }

    if (state.failedTurn) {
        return true;
    }

    if (!state.activeReply) {
        return state.historyLoaded && hasTerminalChatRow(state);
    }

    return (state.activeReply.text ?? '').trim().length > 0;
}

function hasTerminalChatRow(state: ChatTimelineState) {
    return state.timeline.some((row) => {
        if (row.kind !== 'message') {
            return false;
        }

        return row.message.senderType === 'agent' || row.message.senderType === 'system';
    });
}

export function isBlockingActiveTurn(input: {
    activeReply: { isThinking?: boolean | null } | null;
    activeTurn?: unknown;
    agentsPending: boolean;
}) {
    if (input.agentsPending) {
        return true;
    }

    if (input.activeTurn) {
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
    chat: ChatListItem;
    chatId: string;
}) {
    const agentsQuery = useAgentList();
    const modelsQuery = useModelList();
    const chatVirtualization = useChatVirtualizationPreference();
    const agentId = resolveChatAgentId(chat);
    const agents = agentsQuery.data?.agents ?? [];
    const agent = agents.find((entry) => entry.id === agentId) ?? null;
    const conversationLayout = getChatMessageLayout(chat);
    const timeline = useChatTimeline({
        chatId,
        limit: chatDetailLogLimit,
    });
    const rows = timeline.rows;
    const totalMessages = timeline.totalMessages;
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
            agentPresenceColor={agent?.effectivePrimaryColor ?? null}
            animateTimeline={animateTimeline}
            chatId={chat.id}
            conversationLayout={conversationLayout}
            emptyLabel="No synced messages for this chat yet."
            enableVirtualization={chatVirtualization.enabled}
            error={timeline.error}
            failedTurn={timeline.failedTurn}
            fetchPreviousPage={timeline.fetchPreviousPage}
            footer={
                <ChatMessageComposer
                    activeRunId={timeline.activeTurn?.runId ?? timeline.activeReply?.runId ?? null}
                    agentRuntimeSyncLabel={chat.agentRuntimeSyncLabel}
                    agents={agents}
                    boundAgentIds={chat.boundAgentIds}
                    canSend={chat.canSend}
                    chatId={chat.id}
                    contextFullness={contextFullness}
                    isDisabled={chat.isDisabled}
                    isReplyActive={isBlockingActiveTurn({
                        activeReply: timeline.activeReply,
                        activeTurn: timeline.activeTurn,
                        agentsPending: agentsQuery.isPending,
                    })}
                    steerRunId={getSteerableRunId({
                        activeReply: timeline.activeReply,
                        activeTurn: timeline.activeTurn,
                        rows,
                    })}
                />
            }
            hasPreviousPage={timeline.hasPreviousPage}
            historyLoaded={timeline.historyLoaded}
            isFetchingPreviousPage={timeline.isFetchingPreviousPage}
            isPending={timeline.isPending}
            rows={rows}
            totalMessages={totalMessages}
        />
    );
}

function resolveChatAgentId(chat: ChatListItem | null) {
    return chat?.latestSession?.agentId ?? chat?.boundAgentIds[0] ?? '';
}
