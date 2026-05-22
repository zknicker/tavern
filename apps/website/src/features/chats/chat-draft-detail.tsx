import * as React from 'react';
import { useAgentList } from '../../hooks/agents/use-agent-list.ts';
import { mergeTimelineMessages } from '../../hooks/chats/chat-timeline-messages.ts';
import type { ChatActiveReply, ChatTimelineState } from '../../hooks/chats/chat-timeline-state.ts';
import type { ChatStartDraft } from '../../hooks/chats/use-chat-start-drafts.tsx';
import { useChatTimelineRows } from '../../hooks/chats/use-chat-timeline-store.tsx';
import { useChatRuntimeTimelineState } from '../../hooks/chats/use-timeline-context.tsx';
import { markChatTiming } from '../../lib/chat-timing.ts';
import { ChatDetailFrame } from './chat-detail-frame.tsx';
import { ChatMessageComposerSurface } from './chat-message-composer-surface.tsx';

const draftTimelineLimit = 100;

export function ChatDraftDetail({
    animateTimeline = true,
    draft,
    timelineChatId,
    title,
}: {
    animateTimeline?: boolean;
    draft: ChatStartDraft | null;
    timelineChatId: string;
    title?: string;
}) {
    const agentsQuery = useAgentList();
    const boundAgentIds = React.useMemo(() => (draft ? [draft.agentId] : []), [draft]);
    const [agentId, setAgentId] = React.useState(draft?.agentId ?? '');
    const [content, setContent] = React.useState('');
    const handoffState = useChatRuntimeTimelineState(timelineChatId);
    const timeline = useChatTimelineRows({
        chatId: timelineChatId,
        limit: draftTimelineLimit,
        logged: undefined,
    });
    const draftActiveReply = buildDraftActiveReply(draft);
    const handoffFrame = resolveDraftHandoffFrame({
        draftActiveReply,
        handoffState,
    });
    const fallbackTimeline = draft
        ? mergeTimelineMessages({
              limit: draftTimelineLimit,
              logged: undefined,
              messages: [
                  {
                      content: draft.content,
                      id: draft.clientMessageId,
                      metadata: draft.metadata,
                      timestamp: draft.createdAt,
                  },
              ],
          })
        : undefined;
    const visibleTimeline =
        timeline && timeline.rows.length > 0 ? timeline : (fallbackTimeline ?? timeline);

    React.useEffect(() => {
        if (draft && agentId !== draft.agentId) {
            setAgentId(draft.agentId);
        }
    }, [agentId, draft]);

    React.useEffect(() => {
        if (!draft) {
            return;
        }

        markChatTiming('optimistic-chat-visible', {
            draftChatId: draft.id,
            realChatId: draft.realChatId,
        });
        markChatTiming('optimistic-user-message-visible', {
            draftChatId: draft.id,
            messageId: draft.clientMessageId,
        });

        if (draft.status !== 'error') {
            markChatTiming('thinking-visible', {
                draftChatId: draft.id,
                realChatId: draft.realChatId,
                runId: draft.realRunId,
            });
        }
    }, [draft]);

    return (
        <ChatDetailFrame
            activeReply={handoffFrame.activeReply}
            animateTimeline={animateTimeline}
            chatId={timelineChatId}
            emptyLabel=""
            failedTurn={handoffFrame.failedTurn}
            footer={
                <ChatMessageComposerSurface
                    agentId={agentId}
                    agents={agentsQuery.data?.agents ?? []}
                    boundAgentIds={boundAgentIds}
                    canSubmit={false}
                    content={content}
                    contextFullness={null}
                    disabled={false}
                    error={draft?.errorMessage}
                    name="draft-chat-message"
                    onAgentChange={setAgentId}
                    onSubmit={(event) => event?.preventDefault()}
                    onTextChange={setContent}
                    placeholder={
                        draft && draft.status !== 'error'
                            ? 'A reply is already in progress for this chat.'
                            : 'Ask for follow-up changes'
                    }
                />
            }
            historyLoaded
            isPending={false}
            rows={visibleTimeline?.rows ?? []}
            title={title ?? draft?.title ?? 'New chat'}
            totalRows={visibleTimeline?.total ?? 0}
        />
    );
}

export function resolveDraftHandoffFrame({
    draftActiveReply,
    handoffState,
}: {
    draftActiveReply: ChatActiveReply | null;
    handoffState: ChatTimelineState | undefined;
}) {
    return {
        activeReply: handoffState?.activeReply ?? draftActiveReply,
        failedTurn: handoffState?.failedTurn ?? null,
    };
}

export function buildDraftActiveReply(draft: ChatStartDraft | null): ChatActiveReply | null {
    if (!draft || draft.status === 'error') {
        return null;
    }

    return {
        agentId: draft.agentId,
        isThinking: true,
        runId: draft.realRunId ?? draft.clientMessageId,
        sessionKey: draft.realSessionKey ?? draft.realChatId ?? draft.id,
        startedAt: draft.realAcceptedAt ?? draft.createdAt,
        text: '',
    };
}
