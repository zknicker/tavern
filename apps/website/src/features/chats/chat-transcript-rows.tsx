import * as React from 'react';
import { DayDivider } from '../../components/ui/day-divider.tsx';
import type { ChatActiveReply, ChatTurnFailure } from '../../hooks/chats/chat-timeline-state.ts';
import { SessionLogHiddenCount } from '../sessions/session-log-hidden-count.tsx';
import type {
    TranscriptActor,
    TranscriptEntry,
    TranscriptItem,
    TranscriptRow,
} from './chat-transcript-model.ts';
import { useTranscriptRenderContext } from './chat-transcript-render-context.tsx';
import {
    type TranscriptRenderRow,
    transcriptRenderRowUsesActiveReply,
} from './chat-transcript-row-model.ts';
import { TranscriptEntryView } from './chat-transcript-turn.tsx';

interface TranscriptRenderRowProps {
    activePresenceVerb?: string | null;
    activeReply: ChatActiveReply | null;
    agentStatusColor?: string | null;
    failedTurn?: ChatTurnFailure | null;
    presenceRows: TranscriptRow[];
    row: TranscriptRenderRow;
}

interface TranscriptRenderRowViewProps {
    activePresenceVerb?: string | null;
    activeReply: ChatActiveReply | null;
    agentStatusColor?: string | null;
    failedTurn?: ChatTurnFailure | null;
    presenceRows: TranscriptRow[];
    row: TranscriptRenderRow;
}

export function TranscriptRenderRowItem({
    activePresenceVerb = null,
    activeReply,
    row,
    ...props
}: TranscriptRenderRowProps) {
    return (
        <TranscriptRenderRowView
            activePresenceVerb={
                row.kind === 'entry' && row.showPresence ? activePresenceVerb : null
            }
            activeReply={transcriptRenderRowUsesActiveReply(row, activeReply) ? activeReply : null}
            row={row}
            {...props}
        />
    );
}

// Entry and item wrappers are rebuilt on every streaming update, but the
// underlying row objects keep their identity. Comparing structurally lets
// historical rows skip re-rendering while text streams into the live turn.
const TranscriptRenderRowView = React.memo(
    ({
        activeReply,
        activePresenceVerb = null,
        agentStatusColor = null,
        failedTurn = null,
        presenceRows,
        row,
    }: TranscriptRenderRowViewProps) => {
        const {
            chatId,
            conversationLayout,
            currentSessionKey,
            defaultOpenWorkGroups,
            hiddenCount,
        } = useTranscriptRenderContext();

        if (row.kind === 'hiddenCount') {
            return <SessionLogHiddenCount hiddenCount={hiddenCount} />;
        }

        if (row.kind === 'dayDivider') {
            return <DayDivider className="mx-3 mt-3 mb-1" label={row.label} />;
        }

        return (
            <TranscriptEntryView
                activePresenceVerb={row.showPresence ? activePresenceVerb : null}
                activeReply={activeReply}
                agentStatusColor={agentStatusColor}
                chatId={chatId}
                conversationLayout={conversationLayout}
                currentSessionKey={currentSessionKey}
                defaultOpenWorkGroups={defaultOpenWorkGroups}
                entry={row.entry}
                failedTurn={failedTurn}
                followsRuntimeNotice={row.followsRuntimeNotice}
                presenceRows={presenceRows}
                showPresence={row.showPresence}
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
        arePresencePropsEqual(previous, next) &&
        areRenderRowsEqual(previous.row, next.row)
    );
}

function arePresencePropsEqual(
    previous: TranscriptRenderRowViewProps,
    next: TranscriptRenderRowViewProps
) {
    if (!(rowShowsPresence(previous.row) || rowShowsPresence(next.row))) {
        return true;
    }

    return (
        previous.agentStatusColor === next.agentStatusColor &&
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

    return (
        previous.followsRuntimeNotice === next.followsRuntimeNotice &&
        previous.showPresence === next.showPresence &&
        previous.turnStartedAt === next.turnStartedAt &&
        areEntriesEqual(previous.entry, next.entry)
    );
}

function rowShowsPresence(row: TranscriptRenderRow) {
    return row.kind === 'entry' && row.showPresence;
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
