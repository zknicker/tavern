import * as React from 'react';
import { DayDivider } from '../../components/ui/day-divider.tsx';
import type { ChatActiveReply, ChatTurnFailure } from '../../hooks/chats/chat-timeline-state.ts';
import type {
    ConversationMessageLayout,
    TranscriptActor,
    TranscriptEntry,
    TranscriptItem,
    TranscriptRow,
} from './chat-transcript-model.ts';
import type { TranscriptRenderRow } from './chat-transcript-row-model.ts';
import { TranscriptEntryView } from './chat-transcript-turn.tsx';

interface TranscriptEntryRowProps {
    activeReply: ChatActiveReply | null;
    agentPresenceColor?: string | null;
    chatId?: string;
    conversationLayout: ConversationMessageLayout;
    currentSessionKey?: string | null;
    failedTurn?: ChatTurnFailure | null;
    presenceRows: TranscriptRow[];
    row: Extract<TranscriptRenderRow, { kind: 'entry' }>;
}

// Entry and item wrappers are rebuilt on every streaming update, but the
// underlying row objects keep their identity. Comparing structurally lets
// historical rows skip re-rendering while text streams into the live turn.
export const TranscriptEntryRow = React.memo(
    ({
        activeReply,
        agentPresenceColor = null,
        chatId,
        conversationLayout,
        currentSessionKey,
        failedTurn = null,
        presenceRows,
        row,
    }: TranscriptEntryRowProps) => (
        <>
            {row.dayLabel ? <DayDivider className="mx-3 mt-3 mb-1" label={row.dayLabel} /> : null}
            <TranscriptEntryView
                activeReply={activeReply}
                agentPresenceColor={agentPresenceColor}
                chatId={chatId}
                conversationLayout={conversationLayout}
                currentSessionKey={currentSessionKey}
                entry={row.entry}
                failedTurn={failedTurn}
                followsRuntimeNotice={row.followsRuntimeNotice}
                presenceRows={presenceRows}
                showAgentPresence={row.isLatestAgentEntry}
                turnStartedAt={row.turnStartedAt}
            />
        </>
    ),
    areTranscriptEntryRowPropsEqual
);

TranscriptEntryRow.displayName = 'TranscriptEntryRow';

function areTranscriptEntryRowPropsEqual(
    previous: TranscriptEntryRowProps,
    next: TranscriptEntryRowProps
) {
    return (
        previous.activeReply === next.activeReply &&
        previous.chatId === next.chatId &&
        previous.currentSessionKey === next.currentSessionKey &&
        arePresencePropsEqual(previous, next) &&
        previous.conversationLayout.showAgentIdentity ===
            next.conversationLayout.showAgentIdentity &&
        previous.conversationLayout.showHumanIdentity ===
            next.conversationLayout.showHumanIdentity &&
        areRenderRowsEqual(previous.row, next.row)
    );
}

function arePresencePropsEqual(previous: TranscriptEntryRowProps, next: TranscriptEntryRowProps) {
    if (!(previous.row.isLatestAgentEntry || next.row.isLatestAgentEntry)) {
        return true;
    }

    return (
        previous.agentPresenceColor === next.agentPresenceColor &&
        previous.failedTurn === next.failedTurn &&
        previous.presenceRows === next.presenceRows
    );
}

function areRenderRowsEqual(
    previous: TranscriptEntryRowProps['row'],
    next: TranscriptEntryRowProps['row']
) {
    return (
        previous.id === next.id &&
        previous.dayLabel === next.dayLabel &&
        previous.followsRuntimeNotice === next.followsRuntimeNotice &&
        previous.isLatestAgentEntry === next.isLatestAgentEntry &&
        previous.turnStartedAt === next.turnStartedAt &&
        areEntriesEqual(previous.entry, next.entry)
    );
}

function areEntriesEqual(previous: TranscriptEntry, next: TranscriptEntry) {
    if (previous === next) {
        return true;
    }

    if (
        previous.kind !== next.kind ||
        previous.id !== next.id ||
        previous.timestamp !== next.timestamp
    ) {
        return false;
    }

    if (previous.kind === 'system' || next.kind === 'system') {
        return (
            previous.kind === 'system' &&
            next.kind === 'system' &&
            areItemsEqual(previous.item, next.item)
        );
    }

    return (
        previous.key === next.key &&
        previous.participant === next.participant &&
        areActorsEqual(previous.actor, next.actor) &&
        previous.items.length === next.items.length &&
        previous.items.every((item, index) => areItemsEqual(item, next.items[index]))
    );
}

function areItemsEqual(previous: TranscriptItem, next: TranscriptItem | undefined) {
    if (!next) {
        return false;
    }

    if (previous === next) {
        return true;
    }

    if (previous.kind !== next.kind) {
        return false;
    }

    switch (previous.kind) {
        case 'row':
            return next.kind === 'row' && previous.row === next.row;
        case 'activeReply':
            return next.kind === 'activeReply' && previous.reply === next.reply;
        case 'activeStatus':
            return (
                next.kind === 'activeStatus' &&
                previous.reply === next.reply &&
                previous.status === next.status
            );
        case 'failure':
            return next.kind === 'failure' && previous.failure === next.failure;
        default:
            return false;
    }
}

function areActorsEqual(previous: TranscriptActor, next: TranscriptActor) {
    if (previous === next) {
        return true;
    }

    return Boolean(previous && next && previous.kind === next.kind && previous.id === next.id);
}
