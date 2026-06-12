import * as React from 'react';
import {
    PromptInput,
    PromptInputActions,
    PromptInputBody,
    PromptInputFooter,
    PromptInputSubmit,
    PromptInputTools,
} from '../../components/ui/prompt-input.tsx';
import { useAgentList } from '../../hooks/agents/use-agent-list.ts';
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
import { ChatComposerAgentSelector } from './chat-composer-tools.tsx';
import { ChatDetailFrame } from './chat-detail-frame.tsx';

const draftTimelineLimit = 100;

export function ChatDraftDetail({
    animateTimeline = true,
    draft,
    timelineChatId,
}: {
    animateTimeline?: boolean;
    draft: ChatStartDraft | null;
    timelineChatId: string;
}) {
    const agentsQuery = useAgentList();
    const boundAgentIds = React.useMemo(() => (draft ? [draft.agentId] : []), [draft]);
    const [agentId, setAgentId] = React.useState(draft?.agentId ?? '');
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
                <PromptInput
                    error={draft?.errorMessage}
                    onSubmit={(event) => event?.preventDefault()}
                    onTextEditorFocus={mentionComposer.focusTextEditor}
                >
                    <PromptInputBody>
                        <MentionComposerEditor
                            composer={mentionComposer}
                            name="draft-chat-message"
                            placeholder="Ask for follow-up changes"
                        />
                    </PromptInputBody>
                    <MentionComposerPicker composer={mentionComposer} />
                    <PromptInputFooter>
                        <PromptInputTools>
                            <ChatComposerAgentSelector
                                agentId={agentId}
                                agents={agentsQuery.data?.agents ?? []}
                                boundAgentIds={boundAgentIds}
                                onAgentChange={setAgentId}
                            />
                        </PromptInputTools>
                        <PromptInputActions>
                            <PromptInputSubmit
                                canSubmit={false}
                                label="Send message"
                                tooltip={
                                    draft && draft.status !== 'error'
                                        ? 'A reply is already in progress.'
                                        : undefined
                                }
                            />
                        </PromptInputActions>
                    </PromptInputFooter>
                </PromptInput>
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
        activeReply: handoffState.activeReply
            ? {
                  ...handoffState.activeReply,
                  isThinking: handoffState.activeReply.isThinking ?? true,
                  text: handoffState.activeReply.text ?? '',
              }
            : null,
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
