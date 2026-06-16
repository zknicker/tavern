import * as React from 'react';
import { DayDivider } from '../../components/ui/day-divider.tsx';
import type { ChatActiveReply, ChatTurnFailure } from '../../hooks/chats/chat-timeline-state.ts';
import { SessionLogHiddenCount } from '../sessions/session-log-hidden-count.tsx';
import type {
    ConversationMessageLayout,
    TranscriptActor,
    TranscriptEntry,
    TranscriptItem,
    TranscriptRow,
} from './chat-transcript-model.ts';
import type { TranscriptRenderRow } from './chat-transcript-row-model.ts';
import { AgentPresenceTranscriptRow, TranscriptEntryView } from './chat-transcript-turn.tsx';

interface TranscriptRenderRowViewProps {
    activePresenceVerb?: string | null;
    activeReply: ChatActiveReply | null;
    agentPresenceColor?: string | null;
    animateMessages: boolean;
    chatId?: string;
    conversationLayout: ConversationMessageLayout;
    currentSessionKey?: string | null;
    failedTurn?: ChatTurnFailure | null;
    hiddenCount: number;
    presenceRows: TranscriptRow[];
    row: TranscriptRenderRow;
}

// Entry and item wrappers are rebuilt on every streaming update, but the
// underlying row objects keep their identity. Comparing structurally lets
// historical rows skip re-rendering while text streams into the live turn.
export const TranscriptRenderRowView = React.memo(
    ({
        activeReply,
        activePresenceVerb = null,
        agentPresenceColor = null,
        animateMessages,
        chatId,
        conversationLayout,
        currentSessionKey,
        failedTurn = null,
        hiddenCount,
        presenceRows,
        row,
    }: TranscriptRenderRowViewProps) => {
        if (row.kind === 'hiddenCount') {
            return <SessionLogHiddenCount hiddenCount={hiddenCount} />;
        }

        if (row.kind === 'dayDivider') {
            return <DayDivider className="mx-3 mt-3 mb-1" label={row.label} />;
        }

        if (row.kind === 'presence') {
            return (
                <AgentPresenceTranscriptRow
                    activePresenceVerb={activePresenceVerb}
                    activeReply={activeReply}
                    agentPresenceColor={agentPresenceColor}
                    conversationLayout={conversationLayout}
                    entry={row.entry}
                    failedTurn={failedTurn}
                    presenceRows={presenceRows}
                    turnStartedAt={row.turnStartedAt}
                />
            );
        }

        return (
            <TranscriptEntryView
                activeReply={activeReply}
                animateMessages={animateMessages}
                chatId={chatId}
                conversationLayout={conversationLayout}
                currentSessionKey={currentSessionKey}
                entry={row.entry}
                followsRuntimeNotice={row.followsRuntimeNotice}
                turnStartedAt={row.turnStartedAt}
            />
        );
    },
    areTranscriptRenderRowViewPropsEqual
);

TranscriptRenderRowView.displayName = 'TranscriptRenderRowView';

function areTranscriptRenderRowViewPropsEqual(
    previous: TranscriptRenderRowViewProps,
    next: TranscriptRenderRowViewProps
) {
    return (
        previous.activeReply === next.activeReply &&
        previous.activePresenceVerb === next.activePresenceVerb &&
        previous.animateMessages === next.animateMessages &&
        previous.chatId === next.chatId &&
        previous.currentSessionKey === next.currentSessionKey &&
        previous.hiddenCount === next.hiddenCount &&
        arePresencePropsEqual(previous, next) &&
        previous.conversationLayout.showAgentIdentity ===
            next.conversationLayout.showAgentIdentity &&
        previous.conversationLayout.showHumanIdentity ===
            next.conversationLayout.showHumanIdentity &&
        areRenderRowsEqual(previous.row, next.row)
    );
}

function arePresencePropsEqual(
    previous: TranscriptRenderRowViewProps,
    next: TranscriptRenderRowViewProps
) {
    if (!(previous.row.kind === 'presence' || next.row.kind === 'presence')) {
        return true;
    }

    return (
        previous.agentPresenceColor === next.agentPresenceColor &&
        previous.failedTurn === next.failedTurn &&
        previous.presenceRows === next.presenceRows
    );
}

function areRenderRowsEqual(
    previous: TranscriptRenderRowViewProps['row'],
    next: TranscriptRenderRowViewProps['row']
) {
    if (previous.kind !== next.kind || previous.id !== next.id) {
        return false;
    }

    if (previous.kind === 'hiddenCount' || next.kind === 'hiddenCount') {
        return true;
    }

    if (previous.kind === 'dayDivider' || next.kind === 'dayDivider') {
        return (
            previous.kind === 'dayDivider' &&
            next.kind === 'dayDivider' &&
            previous.label === next.label
        );
    }

    if (previous.kind === 'presence' || next.kind === 'presence') {
        return (
            previous.kind === 'presence' &&
            next.kind === 'presence' &&
            previous.turnStartedAt === next.turnStartedAt &&
            areEntriesEqual(previous.entry, next.entry)
        );
    }

    return (
        previous.followsRuntimeNotice === next.followsRuntimeNotice &&
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
