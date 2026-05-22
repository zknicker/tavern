import type {
    ChatActiveReply,
    ChatCompletedProgress,
    ChatTurnFailure,
    ChatTurnProgressStep,
} from '../../hooks/chats/chat-timeline-state.ts';
import type { ChatLogOutput } from '../../lib/trpc.tsx';
import { cn } from '../../lib/utils.ts';
import { SessionLogHiddenCount } from '../sessions/session-log-hidden-count.tsx';
import { ChatTranscript } from './chat-transcript.tsx';
import type { ConversationMessageLayout } from './chat-transcript-model.ts';

export function ChatTimeline({
    activeReply,
    activeReplyProgressStartedAt = null,
    activeReplySteps = [],
    animate = false,
    chatId,
    completedProgress = null,
    conversationLayout,
    failedTurn,
    rows,
    totalRows,
}: {
    activeReply: ChatActiveReply | null;
    activeReplyProgressStartedAt?: string | null;
    activeReplySteps?: ChatTurnProgressStep[];
    animate?: boolean;
    chatId?: string;
    completedProgress?: ChatCompletedProgress | null;
    conversationLayout?: ConversationMessageLayout;
    failedTurn?: ChatTurnFailure | null;
    rows: NonNullable<ChatLogOutput>['rows'];
    totalRows: number;
}) {
    const hiddenCount = Math.max(totalRows - rows.length, 0);

    return (
        <div className={cn('flex flex-col gap-0 py-1', animate && 'animate-float-up')}>
            <SessionLogHiddenCount hiddenCount={hiddenCount} />
            <ChatTranscript
                activeReply={activeReply}
                activeReplyProgressStartedAt={activeReplyProgressStartedAt}
                activeReplySteps={activeReplySteps}
                chatId={chatId}
                completedProgress={completedProgress}
                conversationLayout={conversationLayout}
                failedTurn={failedTurn}
                rows={rows}
            />
        </div>
    );
}
