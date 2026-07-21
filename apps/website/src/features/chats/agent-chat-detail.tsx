import { developmentChatDemoIds } from '@tavern/api/development-chat-demos';
import * as React from 'react';
import { Navigate } from 'react-router-dom';
import { useAgentList } from '../../hooks/agents/use-agent-list.ts';
import { useChatGet } from '../../hooks/chats/use-chat-list.ts';
import { useMarkChatReadOnView } from '../../hooks/chats/use-chat-mark-read.ts';
import { useChatTimeline } from '../../hooks/chats/use-chat-timeline.ts';
import { useModelList } from '../../hooks/models/use-model-list.ts';
import { useChatArtifactPanelState } from '../../hooks/pane/use-chat-pane-state.ts';
import { useChatSidePane } from '../../hooks/pane/use-chat-side-pane.ts';
import { useThreadPane } from '../../hooks/threads/use-thread-pane.ts';
import { useViewportBelow } from '../../hooks/use-viewport-below.ts';
import { appRoutes } from '../../lib/app-routes.ts';
import { MissingAgentState } from '../agents/missing-agent-state.tsx';
import { ArchivedChatBar } from './archived-chat-bar.tsx';
import { ArtifactPanelOpenProvider } from './artifact-panel-context.tsx';
import { getActiveRunIds } from './chat-active-runs.ts';
import { ChatArtifactPanel } from './chat-artifact-panel.tsx';
import { getChatContextFullness } from './chat-context-fullness.ts';
import { ChatDetailFooter } from './chat-detail-footer.tsx';
import { ChatDetailFrame } from './chat-detail-frame.tsx';
import { buildChatListItem, type ChatListItem } from './chat-list-data.ts';
import { ChatMessageComposer } from './chat-message-composer.tsx';
import { getChatMessageLayout } from './chat-message-layout.ts';
import { ChatRoomTopbar } from './chat-room-topbar.tsx';
import { ThreadPanel } from './thread/thread-panel.tsx';

export const chatDetailLogLimit = 24;
export const demoChannelLogLimit = 48;

export function getChatDetailLogLimit(chatId: string) {
    return chatId === developmentChatDemoIds.demo ? demoChannelLogLimit : chatDetailLogLimit;
}

export function AgentChatDetail({ chatId }: { chatId: string }) {
    const chatQuery = useChatGet({ chatId });
    const chat = React.useMemo(
        () => (chatQuery.data ? buildChatListItem(chatQuery.data) : null),
        [chatQuery.data]
    );

    if (!chat) {
        if (chatQuery.isPending) {
            // Chats are persistent, so a cold cache resolves in one fetch —
            // keep the content region mounted and quiet while it lands.
            return <div className="flex min-h-0 flex-1 flex-col" />;
        }

        return <Navigate replace to={appRoutes.activity} />;
    }

    return <SyncedAgentChatDetail chat={chat} chatId={chatId} />;
}

export function isBlockingActiveTurn(input: {
    activeReplies: readonly {
        isThinking?: boolean | null;
        text?: string;
        trigger?: 'evaluation';
    }[];
    activeTurns: readonly { trigger?: 'evaluation' | undefined }[];
    agentsPending: boolean;
}) {
    if (input.agentsPending) {
        return true;
    }

    // Quiet peer-evaluation turns never block the composer: most end in
    // NO_REPLY and the user should keep talking (specs/addressing.md).
    if (input.activeTurns.some((turn) => turn.trigger !== 'evaluation')) {
        return true;
    }

    return input.activeReplies.some(
        (reply) =>
            reply.isThinking !== false &&
            !(reply.trigger === 'evaluation' && (reply.text ?? '').trim().length === 0)
    );
}

function SyncedAgentChatDetail({ chat, chatId }: { chat: ChatListItem; chatId: string }) {
    const agentsQuery = useAgentList();
    const modelsQuery = useModelList();
    const activeSidePane = useChatSidePane(chatId);
    const threadPane = useThreadPane(chatId);
    const threadTakeover = useViewportBelow(1024);
    const threadOpen = activeSidePane === 'thread' && threadPane !== null;
    // Viewing the chat reads it: receipt on open and on each new message —
    // except while the thread takeover hides the parent transcript entirely.
    useMarkChatReadOnView(chatId, { enabled: !(threadOpen && threadTakeover) });
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
    const artifactOpen = activeSidePane === 'artifact' && artifactPanel.visible;
    const threadPanel = (
        <ThreadPanel
            agents={agents}
            chat={chat}
            open={threadOpen}
            parentRows={rows}
            state={threadPane}
            takeover={threadTakeover}
        />
    );
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
                            chat={chat}
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
                header={<ChatRoomTopbar chat={chat} />}
                historyLoaded={timeline.historyLoaded}
                isFetchingOlderHistory={timeline.isFetchingOlderHistory}
                isPending={timeline.isPending}
                rows={rows}
                sidePanel={
                    <>
                        <ChatArtifactPanel
                            agentId={agentId}
                            open={artifactOpen}
                            state={artifactPanel}
                        />
                        {threadTakeover ? null : threadPanel}
                    </>
                }
                takeoverPanel={threadOpen && threadTakeover ? threadPanel : undefined}
                totalMessages={totalMessages}
            />
        </ArtifactPanelOpenProvider>
    );
}

function resolveChatAgentId(chat: ChatListItem | null) {
    return chat?.latestSession?.agentId ?? chat?.boundAgentIds[0] ?? '';
}
