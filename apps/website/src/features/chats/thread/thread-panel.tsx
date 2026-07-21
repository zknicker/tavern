import { useMessageScroller } from '../../../components/ui/message-scroller.tsx';
import { useChatTimeline } from '../../../hooks/chats/use-chat-timeline.ts';
import { flashMessage } from '../../../hooks/threads/use-message-flash.ts';
import { useMarkThreadReadOnView } from '../../../hooks/threads/use-thread-mark-read.ts';
import { closeThreadPane, type ThreadPaneState } from '../../../hooks/threads/use-thread-pane.ts';
import type { AgentListOutput, ChatLogOutput } from '../../../lib/trpc.tsx';
import { trpc } from '../../../lib/trpc.tsx';
import type { ChatListItem } from '../chat-list-data.ts';
import { ChatMessageComposer } from '../chat-message-composer.tsx';
import { getChatMessageLayout } from '../chat-message-layout.ts';
import { ChatSidePaneShell } from '../chat-side-pane-shell.tsx';
import { ChatTranscript } from '../chat-transcript.tsx';
import { buildTranscriptEntries, type TranscriptItem } from '../chat-transcript-model.ts';
import {
    getTranscriptMessageThread,
    type TranscriptMessageRow,
} from '../chat-transcript-render-context.tsx';
import { ThreadAnchorMessage } from './thread-anchor-message.tsx';
import { ThreadPanelHeader } from './thread-panel-header.tsx';
import { threadPaneTitles } from './thread-target.ts';

const threadLogLimit = 48;

export function ThreadPanel({
    agents,
    chat,
    open,
    parentRows,
    state,
    takeover = false,
}: {
    agents: AgentListOutput['agents'];
    chat: ChatListItem;
    open: boolean;
    parentRows: NonNullable<ChatLogOutput>['rows'];
    state: ThreadPaneState | null;
    takeover?: boolean;
}) {
    const scroller = useMessageScroller();
    const follow = trpc.thread.setFollow.useMutation();
    const anchorRow = state ? findAnchorRow(parentRows, state.anchorMessageId) : null;
    const thread = anchorRow ? getTranscriptMessageThread(anchorRow) : null;
    const threadChatId = state?.threadChatId ?? thread?.threadChatId ?? null;
    const titles = state ? threadPaneTitles(chat, state.anchorMessageId) : null;

    if (!(state && anchorRow && titles)) {
        return null;
    }

    const close = () => closeThreadPane(chat.id);
    const viewInChannel = () => {
        const entryId = findAnchorEntryId(parentRows, state.anchorMessageId);
        close();

        if (!entryId) {
            return;
        }

        scrollToAnchor(scroller, entryId, () => flashMessage(chat.id, state.anchorMessageId));
    };

    return (
        <ChatSidePaneShell label="Thread" open={open} takeover={takeover}>
            {(width) => (
                <div
                    className="flex h-full min-h-0 min-w-0 flex-1 flex-col"
                    style={width ? { width } : undefined}
                >
                    <ThreadPanelHeader
                        followed={thread?.followed ?? false}
                        followPending={follow.isPending}
                        header={titles.header}
                        onBack={close}
                        onClose={close}
                        onFollowChange={(next) => {
                            if (threadChatId) {
                                follow.mutate({ follow: next, threadChatId });
                            }
                        }}
                        onViewInChannel={viewInChannel}
                        takeover={takeover}
                        target={titles.target}
                        threadExists={threadChatId !== null}
                    />
                    <div className="min-h-0 flex-1">
                        <ThreadTranscript
                            anchorRow={anchorRow}
                            chat={chat}
                            replyCount={thread?.replyCount ?? 0}
                            threadChatId={threadChatId}
                        />
                    </div>
                    <div className="shrink-0 border-border/70 border-t py-3">
                        <ChatMessageComposer
                            agents={agents}
                            boundAgentIds={chat.boundAgentIds}
                            canSend={chat.canSend}
                            chatId={chat.id}
                            conversationKind={chat.conversationKind}
                            isDisabled={chat.isDisabled}
                            isReplyActive={false}
                            placeholder="Message thread"
                            threadTarget={{ anchorMessageId: state.anchorMessageId }}
                        />
                    </div>
                </div>
            )}
        </ChatSidePaneShell>
    );
}

function ThreadTranscript({
    anchorRow,
    chat,
    replyCount,
    threadChatId,
}: {
    anchorRow: TranscriptMessageRow;
    chat: ChatListItem;
    replyCount: number;
    threadChatId: string | null;
}) {
    if (!threadChatId) {
        return (
            <ChatTranscript
                activeReplies={[]}
                leadingContent={<ThreadLeadingContent anchorRow={anchorRow} replyCount={0} />}
                rows={[]}
                threadActionsEnabled={false}
                viewportClassName="px-4 pb-6"
            />
        );
    }

    return (
        <SyncedThreadTranscript
            anchorRow={anchorRow}
            chat={chat}
            replyCount={replyCount}
            threadChatId={threadChatId}
        />
    );
}

function SyncedThreadTranscript({
    anchorRow,
    chat,
    replyCount,
    threadChatId,
}: {
    anchorRow: TranscriptMessageRow;
    chat: ChatListItem;
    replyCount: number;
    threadChatId: string;
}) {
    const timeline = useChatTimeline({ chatId: threadChatId, limit: threadLogLimit });
    useMarkThreadReadOnView({ parentChatId: chat.id, threadChatId });

    return (
        <ChatTranscript
            activeReplies={timeline.activeReplies}
            chatId={threadChatId}
            conversationLayout={getChatMessageLayout(chat)}
            failedTurns={timeline.failedTurns}
            leadingContent={<ThreadLeadingContent anchorRow={anchorRow} replyCount={replyCount} />}
            rows={timeline.rows}
            threadActionsEnabled={false}
            viewportClassName="px-4 pb-6"
        />
    );
}

function ThreadLeadingContent({
    anchorRow,
    replyCount,
}: {
    anchorRow: TranscriptMessageRow;
    replyCount: number;
}) {
    return (
        <div>
            <ThreadAnchorMessage row={anchorRow} />
            {replyCount > 0 ? (
                <div className="my-3 flex items-center gap-3 px-4 text-center text-meta text-muted-foreground">
                    <div className="h-px flex-1 bg-border" />
                    <div>
                        <div>Beginning of replies</div>
                        <div>{`${String(replyCount)} ${replyCount === 1 ? 'reply' : 'replies'}`}</div>
                    </div>
                    <div className="h-px flex-1 bg-border" />
                </div>
            ) : (
                <div className="px-4 py-8 text-center text-muted-foreground text-sm">
                    No replies yet
                </div>
            )}
        </div>
    );
}

function findAnchorRow(rows: NonNullable<ChatLogOutput>['rows'], messageId: string) {
    return (
        rows.find(
            (row): row is Extract<typeof row, { kind: 'message' }> =>
                row.kind === 'message' && row.message.id === messageId
        ) ?? null
    );
}

function findAnchorEntryId(rows: NonNullable<ChatLogOutput>['rows'], messageId: string) {
    const entries = buildTranscriptEntries({ activeReplies: [], rows });
    return (
        entries.find(
            (entry) =>
                entry.kind === 'turn' &&
                entry.items.some((item: TranscriptItem) =>
                    item.kind === 'row' && item.row.kind === 'message'
                        ? item.row.message.id === messageId
                        : false
                )
        )?.id ?? null
    );
}

function scrollToAnchor(
    scroller: ReturnType<typeof useMessageScroller>,
    entryId: string,
    onScrolled: () => void
) {
    let frames = 0;
    const attempt = () => {
        if (scroller.scrollToMessage(entryId, { align: 'center', behavior: 'smooth' })) {
            onScrolled();
            return;
        }
        frames += 1;
        if (frames < 12) {
            window.requestAnimationFrame(attempt);
        }
    };
    window.requestAnimationFrame(attempt);
}
