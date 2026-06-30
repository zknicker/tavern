import {
    getItemSessionKey,
    isActivityBackedMessageRow,
    type TranscriptEntry,
    type TranscriptItem,
} from './chat-transcript-model.ts';
import type { TranscriptRenderRow } from './chat-transcript-row-model.ts';

export interface ChatTurnTimelineMarker {
    agentRowIndex: number;
    agentText: string;
    id: string;
    messageId: string;
    rowIndex: number;
    status: 'active' | 'completed' | 'failed' | 'stopped';
    timestamp: string | null;
    userText: string;
}

export function buildChatTurnTimelineMarkers(
    rows: TranscriptRenderRow[]
): ChatTurnTimelineMarker[] {
    const markers: ChatTurnTimelineMarker[] = [];
    let pendingUser: {
        entry: Extract<TranscriptEntry, { kind: 'turn' }>;
        rowIndex: number;
    } | null = null;

    rows.forEach((row, rowIndex) => {
        if (row.kind !== 'entry' || row.entry.kind !== 'turn') {
            return;
        }

        if (row.entry.participant === 'user') {
            pendingUser = { entry: row.entry, rowIndex };
            return;
        }

        if (row.entry.participant !== 'agent' || !pendingUser) {
            return;
        }

        if (!entriesShareSession(pendingUser.entry, row.entry)) {
            pendingUser = null;
            return;
        }

        const userText = getUserPreviewText(pendingUser.entry);

        if (!userText) {
            pendingUser = null;
            return;
        }

        markers.push({
            agentText: getAgentPreviewText(row.entry),
            agentRowIndex: rowIndex,
            id: `${pendingUser.entry.id}:${row.entry.responseId ?? row.entry.id}`,
            messageId: pendingUser.entry.id,
            rowIndex: pendingUser.rowIndex,
            status: getAgentTurnStatus(row.entry),
            timestamp: pendingUser.entry.timestamp ?? row.entry.timestamp,
            userText,
        });
        pendingUser = null;
    });

    return markers;
}

function entriesShareSession(
    userEntry: Extract<TranscriptEntry, { kind: 'turn' }>,
    agentEntry: Extract<TranscriptEntry, { kind: 'turn' }>
) {
    const userSessionKey = getEntrySessionKey(userEntry);
    const agentSessionKey = getEntrySessionKey(agentEntry);

    return !(userSessionKey && agentSessionKey) || userSessionKey === agentSessionKey;
}

function getEntrySessionKey(entry: Extract<TranscriptEntry, { kind: 'turn' }>) {
    return entry.items.map(getItemSessionKey).find((value) => value !== null) ?? null;
}

function getUserPreviewText(entry: Extract<TranscriptEntry, { kind: 'turn' }>) {
    return (
        entry.items
            .map((item) => (item.kind === 'row' && item.row.kind === 'message' ? item.row : null))
            .filter((row) => row?.message.senderType === 'user')
            .map((row) => row?.message.content ?? '')
            .find((content) => content.trim().length > 0) ?? ''
    ).trim();
}

function getAgentPreviewText(entry: Extract<TranscriptEntry, { kind: 'turn' }>) {
    for (let index = entry.items.length - 1; index >= 0; index -= 1) {
        const item = entry.items[index];
        const text = getAgentItemPreviewText(item);

        if (text) {
            return text;
        }
    }

    return 'Working...';
}

function getAgentItemPreviewText(item: TranscriptItem | undefined) {
    if (!item) {
        return '';
    }

    if (item.kind === 'activeReply') {
        return item.reply.text?.trim() || 'Writing reply...';
    }

    if (item.kind === 'activeStatus') {
        return 'Thinking...';
    }

    if (item.kind === 'failure') {
        return item.failure.error.trim() || 'Response failed.';
    }

    if (item.row.kind === 'message' && !isActivityBackedMessageRow(item.row)) {
        return item.row.message.content.trim();
    }

    if (item.row.kind === 'system' && item.row.systemKind === 'turnStatus') {
        return item.row.turnStatus.text.trim();
    }

    return '';
}

function getAgentTurnStatus(entry: Extract<TranscriptEntry, { kind: 'turn' }>) {
    if (entry.items.some((item) => item.kind === 'failure')) {
        return 'failed';
    }

    if (
        entry.items.some(
            (item) =>
                item.kind === 'row' &&
                item.row.kind === 'system' &&
                item.row.systemKind === 'turnStatus'
        )
    ) {
        return 'stopped';
    }

    if (entry.items.some((item) => item.kind === 'activeReply' || item.kind === 'activeStatus')) {
        return 'active';
    }

    return 'completed';
}
