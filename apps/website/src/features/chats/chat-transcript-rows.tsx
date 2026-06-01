import { DayDivider } from '../../components/ui/day-divider.tsx';
import type { ChatActiveReply } from '../../hooks/chats/chat-timeline-state.ts';
import type { ConversationMessageLayout } from './chat-transcript-model.ts';
import type { TranscriptRenderRow } from './chat-transcript-row-model.ts';
import { TranscriptEntryView } from './chat-transcript-turn.tsx';

export function TranscriptEntryRow({
    activeReply,
    chatId,
    conversationLayout,
    currentSessionKey,
    row,
}: {
    activeReply: ChatActiveReply | null;
    chatId?: string;
    conversationLayout: ConversationMessageLayout;
    currentSessionKey?: string | null;
    row: Extract<TranscriptRenderRow, { kind: 'entry' }>;
}) {
    return (
        <>
            {row.dayLabel ? <DayDivider className="mx-3 mt-3 mb-1" label={row.dayLabel} /> : null}
            <TranscriptEntryView
                activeReply={activeReply}
                chatId={chatId}
                conversationLayout={conversationLayout}
                currentSessionKey={currentSessionKey}
                entry={row.entry}
                followsRuntimeNotice={row.followsRuntimeNotice}
                turnStartedAt={row.turnStartedAt}
            />
        </>
    );
}
