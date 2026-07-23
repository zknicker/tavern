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
import { TasksSurface } from '../tasks/tasks-surface.tsx';
import { ArchivedChatBar } from './archived-chat-bar.tsx';
import { ArtifactPanelOpenProvider } from './artifact-panel-context.tsx';
import { getActiveRunIds } from './chat-active-runs.ts';
import { ChatAgentProfilePanel } from './chat-agent-profile-panel.tsx';
import { ChatArtifactPanel } from './chat-artifact-panel.tsx';
import { getChatContextFullness } from './chat-context-fullness.ts';
import { ChatDetailFooter } from './chat-detail-footer.tsx';
import { ChatDetailFrame } from './chat-detail-frame.tsx';
import { ChatFilesTab } from './chat-files-tab.tsx';
import { buildChatListItem, type ChatListItem } from './chat-list-data.ts';
import { ChatMessageComposer } from './chat-message-composer.tsx';
import { getChatMessageLayout } from './chat-message-layout.ts';
import { ChatRoomTopbar } from './chat-room-topbar.tsx';
import { type ChatViewTab, ChatViewTabs, supportsChatViewTabs } from './chat-view-tabs.tsx';
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

    return <SyncedAgentChatDetail chat={chat} chatId={chatId} key={chatId} />;
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
    const [viewTab, setViewTab] = React.useState<ChatViewTab>('chat');
    const hasViewTabs = supportsChatViewTabs(chat);
    const activeViewTab = hasViewTabs ? viewTab : 'chat';
    const agentsQuery = useAgentList();
    const modelsQuery = useModelList();
    const activeSidePane = useChatSidePane(chatId);
    const threadPane = useThreadPane(chatId);
    const threadTakeover = useViewportBelow(1024);
    const threadOpen = activeSidePane === 'thread' && threadPane !== null;
    // Only the visible parent transcript reads the chat. Tasks, Files, and a
    // thread takeover keep this route mounted while hiding that transcript.
    useMarkChatReadOnView(chatId, {
        enabled: activeViewTab === 'chat' && !(threadOpen && threadTakeover),
    });
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
                body={
                    activeViewTab === 'tasks' ? (
                        <TasksSurface chatId={chatId} />
                    ) : activeViewTab === 'files' ? (
                        <ChatFilesTab chatId={chatId} enabled={activeViewTab === 'files'} />
                    ) : undefined
                }
                canRequestMention={!chat.archived}
                chatId={chat.id}
                conversationLayout={conversationLayout}
                emptyLabel="No synced messages for this chat yet."
                error={timeline.error}
                fetchOlderHistory={timeline.fetchOlderHistory}
                footer={
                    activeViewTab !== 'chat' ? null : chat.archived ? (
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
                header={
                    <>
                        <ChatRoomTopbar chat={chat} />
                        {hasViewTabs ? (
                            <ChatViewTabs onValueChange={setViewTab} value={activeViewTab} />
                        ) : null}
                    </>
                }
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
                        <ChatAgentProfilePanel chatId={chatId} />
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
