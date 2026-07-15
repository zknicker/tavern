import { developmentChatDemoIds } from '@tavern/api/development-chat-demos';
import * as React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAgentList } from '../../hooks/agents/use-agent-list.ts';
import type { ChatTimelineState } from '../../hooks/chats/chat-timeline-state.ts';
import { getChatDraftRouteState } from '../../hooks/chats/use-chat-draft-launch.ts';
import { useChatDraftStart } from '../../hooks/chats/use-chat-draft-start.ts';
import { useChatGet } from '../../hooks/chats/use-chat-list.ts';
import { useChatStartDrafts } from '../../hooks/chats/use-chat-start-drafts.tsx';
import { useChatTimeline } from '../../hooks/chats/use-chat-timeline.ts';
import { useModelList } from '../../hooks/models/use-model-list.ts';
import { useChatArtifactPanelState } from '../../hooks/pane/use-chat-pane-state.ts';
import { useAppLayoutPreference } from '../../hooks/shell/use-app-layout-preference.ts';
import { appRoutes } from '../../lib/app-routes.ts';
import { MissingAgentState } from '../agents/missing-agent-state.tsx';
import { ArchivedChatBar } from './archived-chat-bar.tsx';
import { ArtifactPanelOpenProvider } from './artifact-panel-context.tsx';
import { getActiveRunIds } from './chat-active-runs.ts';
import { ChatArtifactPanel } from './chat-artifact-panel.tsx';
import { getChatContextFullness } from './chat-context-fullness.ts';
import { ChatDetailFooter } from './chat-detail-footer.tsx';
import { ChatDetailFrame } from './chat-detail-frame.tsx';
import { ChatDraftDetail } from './chat-draft-detail.tsx';
import { buildChatListItem, type ChatListItem } from './chat-list-data.ts';
import { ChatMessageComposer } from './chat-message-composer.tsx';
import { getChatMessageLayout } from './chat-message-layout.ts';
import { buildChatPath } from './chat-path.ts';
import { ChatRoomTopbar } from './chat-room-topbar.tsx';

export const chatDetailLogLimit = 24;
export const demoChannelLogLimit = 48;

export function getChatDetailLogLimit(chatId: string) {
    return chatId === developmentChatDemoIds.demo ? demoChannelLogLimit : chatDetailLogLimit;
}

export function AgentChatDetail({ chatId }: { chatId: string }) {
    const location = useLocation();
    const routeState = getChatDraftRouteState(location.state);
    const isDraftRoute = chatId === 'new';
    const chatQuery = useChatGet({ chatId }, { enabled: !isDraftRoute });
    const drafts = useChatStartDrafts();
    const routeDraft = drafts.getDraft(routeState?.draftChatId);
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
    }, [chat, chatId, routeDraft]);

    if (isDraftRoute) {
        if (!routeDraft) {
            return <Navigate replace to={appRoutes.overview} />;
        }

        return <ChatDraftDetail draft={routeDraft} timelineChatId={routeDraft.id} />;
    }

    if (routeDraft?.realChatId === chatId && releasedDraftId !== routeDraft.id) {
        return <ChatDraftDetail draft={routeDraft} timelineChatId={chatId} />;
    }

    if (!chat) {
        if (reconciledDraft) {
            return <ChatDraftDetail draft={reconciledDraft} timelineChatId={chatId} />;
        }

        if (chatQuery.isPending) {
            return <ChatDraftDetail draft={null} timelineChatId={chatId} />;
        }

        return <Navigate replace to={appRoutes.overview} />;
    }

    return <SyncedAgentChatDetail chat={chat} chatId={chatId} />;
}

export function shouldReleaseDraftHandoff(state: ChatTimelineState | undefined) {
    if (!state) {
        return false;
    }

    if (state.failedTurns.length > 0) {
        return true;
    }

    if (state.activeReplies.length === 0) {
        return state.historyLoaded && hasTerminalChatRow(state);
    }

    return state.activeReplies.some((reply) => (reply.text ?? '').trim().length > 0);
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
    activeReplies: readonly { isThinking?: boolean | null }[];
    activeTurns: readonly unknown[];
    agentsPending: boolean;
}) {
    if (input.agentsPending) {
        return true;
    }

    if (input.activeTurns.length > 0) {
        return true;
    }

    return input.activeReplies.some((reply) => reply.isThinking !== false);
}

function SyncedAgentChatDetail({ chat, chatId }: { chat: ChatListItem; chatId: string }) {
    const { mode: layoutMode } = useAppLayoutPreference();
    const agentsQuery = useAgentList();
    const modelsQuery = useModelList();
    const agentId = resolveChatAgentId(chat);
    const agents = agentsQuery.data?.agents ?? [];
    const agent = agents.find((entry) => entry.id === agentId) ?? null;
    const conversationLayout = getChatMessageLayout(chat);
    const timeline = useChatTimeline({
        chatId,
        limit: getChatDetailLogLimit(chatId),
    });
    const rows = timeline.rows;
    const totalMessages = timeline.totalMessages;
    const contextFullness = modelsQuery.data
        ? getChatContextFullness({
              models: modelsQuery.data.models,
              rows,
          })
        : null;
    const artifactPanel = useChatArtifactPanelState(chatId);
    const isTurnBlocking = isBlockingActiveTurn({
        activeReplies: timeline.activeReplies,
        activeTurns: timeline.activeTurns,
        agentsPending: agentsQuery.isPending,
    });

    if (!(agent || agentsQuery.isPending)) {
        return <MissingAgentState agentId={agentId} />;
    }

    return (
        <ArtifactPanelOpenProvider onOpen={artifactPanel.open}>
            <ChatDetailFrame
                activeReplies={timeline.activeReplies}
                agentStatusCharacter={agent?.effectiveCharacter ?? null}
                artifactPanel={
                    <ChatArtifactPanel
                        agentId={agentId}
                        chromeHidden={layoutMode === 'tabs'}
                        state={artifactPanel}
                    />
                }
                chatId={chat.id}
                conversationLayout={conversationLayout}
                emptyLabel="No synced messages for this chat yet."
                error={timeline.error}
                failedTurns={timeline.failedTurns}
                fetchOlderHistory={timeline.fetchOlderHistory}
                footer={
                    chat.archived ? (
                        <ArchivedChatBar
                            chatId={chat.id}
                            conversationKind={chat.conversationKind}
                        />
                    ) : (
                        <ChatDetailFooter
                            activeReplies={timeline.activeReplies}
                            agents={agents}
                            chatId={chat.id}
                            rows={rows}
                            turnEvidence={timeline.turnEvidence}
                        >
                            <ChatMessageComposer
                                activeRunIds={getActiveRunIds(timeline)}
                                agentRuntimeSyncLabel={chat.agentRuntimeSyncLabel}
                                agents={agents}
                                boundAgentIds={chat.boundAgentIds}
                                canSend={chat.canSend}
                                chatId={chat.id}
                                contextFullness={contextFullness}
                                conversationKind={chat.conversationKind}
                                isDisabled={chat.isDisabled}
                                isReplyActive={isTurnBlocking}
                            />
                        </ChatDetailFooter>
                    )
                }
                hasOlderHistory={timeline.hasOlderHistory}
                // Sidebar layout keeps the chat topbar (room identity, traffic
                // light clearance); tabs layout renders the breadcrumb and
                // participants in the shell toolbar instead.
                header={layoutMode === 'sidebar' ? <ChatRoomTopbar chat={chat} /> : null}
                historyLoaded={timeline.historyLoaded}
                isFetchingOlderHistory={timeline.isFetchingOlderHistory}
                isPending={timeline.isPending}
                rows={rows}
                totalMessages={totalMessages}
            />
        </ArtifactPanelOpenProvider>
    );
}

function resolveChatAgentId(chat: ChatListItem | null) {
    return chat?.latestSession?.agentId ?? chat?.boundAgentIds[0] ?? '';
}
