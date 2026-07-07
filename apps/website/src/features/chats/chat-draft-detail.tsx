import * as React from 'react';
import {
    PromptInput,
    PromptInputActions,
    PromptInputBody,
    PromptInputFooter,
    PromptInputSubmit,
} from '../../components/ui/prompt-input.tsx';
import { useAgentList } from '../../hooks/agents/use-agent-list.ts';
import { createChatRunId } from '../../hooks/chats/chat-run-id.ts';
import { mergeTimelineMessages } from '../../hooks/chats/chat-timeline-messages.ts';
import type { ChatActiveReply, ChatTimelineState } from '../../hooks/chats/chat-timeline-state.ts';
import type { ChatStartDraft } from '../../hooks/chats/use-chat-start-drafts.tsx';
import { useChatTimelineRows } from '../../hooks/chats/use-chat-timeline-store.tsx';
import { useChatRuntimeTimelineState } from '../../hooks/chats/use-timeline-context.tsx';
import { markChatTiming } from '../../lib/chat-timing.ts';
import type { ChatLogOutput } from '../../lib/trpc.tsx';
import {
    MentionComposerEditor,
    MentionComposerPicker,
    useMentionComposer,
} from '../mentions/use-mention-composer.tsx';
import { ChatDetailFooter } from './chat-detail-footer.tsx';
import { ChatDetailFrame } from './chat-detail-frame.tsx';
import { ChatMessageComposer } from './chat-message-composer.tsx';
import { getSteerableTurnTargets } from './chat-steering.ts';

const draftTimelineLimit = 100;

export function ChatDraftDetail({
    draft,
    timelineChatId,
}: {
    draft: ChatStartDraft | null;
    timelineChatId: string;
}) {
    const agentsQuery = useAgentList();
    const boundAgentIds = React.useMemo(() => (draft ? [draft.agentId] : []), [draft]);
    const agentId = draft?.agentId ?? '';
    const selectedAgent = agentsQuery.data?.agents.find((agent) => agent.id === agentId) ?? null;
    const [content, setContent] = React.useState('');
    const mentionComposer = useMentionComposer({
        agentId,
        agents: agentsQuery.data?.agents ?? [],
        content,
        onTextChange: setContent,
        onSubmit: () => undefined,
    });
    const handoffState = useChatRuntimeTimelineState(timelineChatId);
    const handoffLog = buildDraftHandoffLog(handoffState);
    const timeline = useChatTimelineRows({
        chatId: timelineChatId,
        limit: draftTimelineLimit,
        logged: handoffLog,
    });
    const draftActiveReply = buildDraftActiveReply(draft);
    const handoffFrame = resolveDraftHandoffFrame({
        draftActiveReply,
        handoffState,
    });
    const canUseSyncedComposer = canDraftUseSyncedComposer(draft);
    const composerChatId = canUseSyncedComposer ? draft.realChatId : null;
    const activeRunId =
        handoffState?.activeTurns[0]?.runId ??
        handoffFrame.activeReplies[0]?.runId ??
        draft?.realRunId ??
        null;
    const steerTargets = getSteerableTurnTargets({
        activeReplies: handoffFrame.activeReplies,
        activeTurns: handoffState?.activeTurns ?? [],
        rows: handoffState?.timeline,
    });
    const fallbackTimeline = draft
        ? mergeTimelineMessages({
              limit: draftTimelineLimit,
              logged: undefined,
              messages: [
                  {
                      content: draft.content,
                      id: draft.clientMessageId,
                      timestamp: draft.createdAt,
                  },
              ],
          })
        : undefined;
    const visibleTimeline =
        timeline && timeline.rows.length > 0 ? timeline : (fallbackTimeline ?? timeline);

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
            activeReplies={handoffFrame.activeReplies}
            agentStatusCharacter={selectedAgent?.effectiveCharacter ?? null}
            chatId={timelineChatId}
            emptyLabel=""
            failedTurns={handoffFrame.failedTurns}
            footer={
                <ChatDetailFooter
                    activeReplies={handoffFrame.activeReplies}
                    agents={agentsQuery.data?.agents ?? []}
                    rows={visibleTimeline?.rows ?? []}
                >
                    {composerChatId ? (
                        <ChatMessageComposer
                            activeRunIds={activeRunId ? [activeRunId] : []}
                            agents={agentsQuery.data?.agents ?? []}
                            boundAgentIds={boundAgentIds}
                            canSend
                            chatId={composerChatId}
                            conversationKind="direct"
                            isDisabled={false}
                            isReplyActive={isDraftReplyActive({
                                activeReplies: handoffFrame.activeReplies,
                                activeTurns: handoffState?.activeTurns ?? [],
                                agentsPending: agentsQuery.isPending,
                                draft,
                            })}
                            steerTargets={steerTargets}
                        />
                    ) : (
                        <PromptInput
                            error={draft?.errorMessage}
                            onSubmit={(event) => event?.preventDefault()}
                            onTextEditorFocus={mentionComposer.focusTextEditor}
                        >
                            <PromptInputBody>
                                <MentionComposerEditor
                                    ariaLabel="Chat message"
                                    composer={mentionComposer}
                                    name="draft-chat-message"
                                    placeholder="Let's go on an adventure..."
                                />
                            </PromptInputBody>
                            <MentionComposerPicker composer={mentionComposer} />
                            <PromptInputFooter>
                                <PromptInputActions>
                                    <PromptInputSubmit
                                        canSubmit={false}
                                        label="Send message"
                                        tooltip={
                                            draft && draft.status !== 'error'
                                                ? 'Chat is still being created.'
                                                : undefined
                                        }
                                    />
                                </PromptInputActions>
                            </PromptInputFooter>
                        </PromptInput>
                    )}
                </ChatDetailFooter>
            }
            historyLoaded
            isPending={false}
            rows={visibleTimeline?.rows ?? []}
            totalMessages={visibleTimeline?.totalMessages ?? 0}
        />
    );
}

export function buildDraftHandoffLog(
    handoffState: ChatTimelineState | undefined
): ChatLogOutput | undefined {
    if (!handoffState || handoffState.timeline.length === 0) {
        return undefined;
    }

    return {
        activeReplies: handoffState.activeReplies.map((reply) => ({
            ...reply,
            isThinking: reply.isThinking ?? true,
            text: reply.text ?? '',
        })),
        failedTurns: handoffState.failedTurns,
        limit: Math.max(handoffState.timeline.length, draftTimelineLimit),
        nextBeforeSequence: null,
        rows: handoffState.timeline,
        totalMessages: handoffState.totalMessages,
    };
}

export function resolveDraftHandoffFrame({
    draftActiveReply,
    handoffState,
}: {
    draftActiveReply: ChatActiveReply | null;
    handoffState: ChatTimelineState | undefined;
}) {
    const handoffReplies = handoffState?.activeReplies ?? [];

    return {
        activeReplies:
            handoffReplies.length > 0 ? handoffReplies : draftActiveReply ? [draftActiveReply] : [],
        failedTurns: handoffState?.failedTurns ?? [],
    };
}

export function buildDraftActiveReply(draft: ChatStartDraft | null): ChatActiveReply | null {
    if (!draft || draft.status === 'error') {
        return null;
    }

    return {
        agentId: draft.agentId,
        isThinking: true,
        runId: draft.realRunId ?? createChatRunId(draft.clientMessageId),
        sessionKey: draft.realTurnReference ?? draft.realChatId ?? draft.id,
        startedAt: draft.realAcceptedAt ?? draft.createdAt,
        text: '',
    };
}

export function canDraftUseSyncedComposer(
    draft: ChatStartDraft | null
): draft is ChatStartDraft & { realChatId: string } {
    return draft?.status !== 'error' && typeof draft?.realChatId === 'string';
}

export function isDraftReplyActive({
    activeReplies,
    activeTurns,
    agentsPending,
    draft,
}: {
    activeReplies: readonly { isThinking?: boolean | null }[];
    activeTurns: readonly unknown[];
    agentsPending: boolean;
    draft: Pick<ChatStartDraft, 'status'> | null;
}) {
    if (agentsPending) {
        return true;
    }

    if (draft?.status === 'error') {
        return false;
    }

    if (activeTurns.length > 0) {
        return true;
    }

    return activeReplies.some((reply) => reply.isThinking !== false);
}
