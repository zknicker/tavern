import type {
    ChatTurnFailure,
    ChatTurnProgressStep,
} from '../../hooks/chats/chat-timeline-state.ts';
import type { ChatLogOutput, ChatStatusListOutput } from '../../lib/trpc.tsx';
import { cn } from '../../lib/utils.ts';
import { SessionLogHiddenCount } from '../sessions/session-log-hidden-count.tsx';
import { ChatTranscript } from './chat-transcript.tsx';
import type { ConversationMessageLayout } from './chat-transcript-model.ts';

export function ChatTimeline({
    activeReply,
    activeReplySteps = [],
    animate = false,
    conversationLayout,
    failedTurn,
    rows,
    totalRows,
}: {
    activeReply: ChatStatusListOutput['chats'][number]['activeReply'] | null;
    activeReplySteps?: ChatTurnProgressStep[];
    animate?: boolean;
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
                activeReplySteps={activeReplySteps}
                conversationLayout={conversationLayout}
                failedTurn={failedTurn}
                rows={rows}
            />
        </div>
    );
}
