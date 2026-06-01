import type { ChatActiveReply, ChatTurnFailure } from '../../hooks/chats/chat-timeline-state.ts';
import type { ChatLogOutput, SessionHistoryOutput } from '../../lib/trpc.tsx';
import { getTranscriptItemKey } from './chat-transcript-item-utils.ts';

export type TranscriptRow =
    | NonNullable<ChatLogOutput>['rows'][number]
    | SessionHistoryOutput['rows'][number];

export type TranscriptActor = Exclude<
    Extract<TranscriptRow, { kind: 'message' | 'tool' | 'worker' }>['actor'],
    undefined
>;

export interface ConversationMessageLayout {
    showAgentIdentity: boolean;
    showHumanIdentity: boolean;
}

export type TranscriptItem =
    | { kind: 'activeReply'; reply: ChatActiveReply }
    | { kind: 'activeStatus'; reply: ChatActiveReply; status: 'thinking' | 'typing' }
    | { failure: ChatTurnFailure; kind: 'failure' }
    | { kind: 'row'; row: TranscriptRow };

export interface TranscriptSystemEntry {
    id: string;
    item: TranscriptItem;
    kind: 'system';
    timestamp: string | null;
}

export interface TranscriptTurnEntry {
    actor: TranscriptActor;
    id: string;
    items: TranscriptItem[];
    key: string;
    kind: 'turn';
    participant: 'agent' | 'user';
    timestamp: string | null;
}

export type TranscriptEntry = TranscriptSystemEntry | TranscriptTurnEntry;

const turnMaxGapMs = 5 * 60 * 1000;

export function buildTranscriptEntries(input: {
    activeReply: ChatActiveReply | null;
    failedTurn?: ChatTurnFailure | null;
    rows: TranscriptRow[];
}) {
    const items = buildTranscriptItems(input);
    const entries: TranscriptEntry[] = [];

    for (const item of items) {
        const participant = getItemParticipant(item);

        if (participant === 'system') {
            entries.push({
                id: getTranscriptItemKey(item),
                item,
                kind: 'system',
                timestamp: getItemTimestamp(item),
            });
            continue;
        }

        const key = getTurnKey(item, participant);
        const previous = entries.at(-1);

        if (previous?.kind === 'turn' && canAppendToTurn(previous, item, participant, key)) {
            previous.items.push(item);
            continue;
        }

        entries.push({
            actor: getItemActor(item),
            id: getTranscriptItemKey(item),
            items: [item],
            key,
            kind: 'turn',
            participant,
            timestamp: getItemTimestamp(item),
        });
    }

    return entries;
}

function buildTranscriptItems(input: {
    activeReply: ChatActiveReply | null;
    failedTurn?: ChatTurnFailure | null;
    rows: TranscriptRow[];
}) {
    let lastActiveProgressRow: TranscriptRow | null = null;
    const items: TranscriptItem[] = input.rows.map((row) => {
        if (input.activeReply && isActiveProgressRow(row, input.activeReply)) {
            lastActiveProgressRow = row;
        }

        return { kind: 'row', row };
    });
    const activeReplyText = input.activeReply?.text?.trim() ?? '';

    if (input.activeReply && activeReplyText.length > 0) {
        items.push({ kind: 'activeReply', reply: input.activeReply });
    }

    if (
        input.activeReply &&
        activeReplyText.length === 0 &&
        shouldShowActiveStatus(lastActiveProgressRow)
    ) {
        items.push({
            kind: 'activeStatus',
            reply: input.activeReply,
            status: input.activeReply.isThinking === false ? 'typing' : 'thinking',
        });
    }

    if (input.failedTurn) {
        items.push({ failure: input.failedTurn, kind: 'failure' });
    }

    return items;
}

function shouldShowActiveStatus(lastProgressRow: TranscriptRow | null) {
    return !lastProgressRow || isAssistantNarrationRow(lastProgressRow);
}

function isActiveProgressRow(row: TranscriptRow, activeReply: ChatActiveReply) {
    if (row.kind === 'message') {
        return false;
    }

    const activeSessionKey = activeReply.sessionKey.trim();
    const activeStartedAt = parseTimestamp(activeReply.startedAt);
    const rowSessionKey = getRowSessionKey(row);

    if (activeSessionKey && rowSessionKey && rowSessionKey !== activeSessionKey) {
        return false;
    }

    return parseTimestamp(getRowTimestamp(row)) >= activeStartedAt;
}

function isAssistantNarrationRow(row: TranscriptRow) {
    return row.kind === 'tool' && row.toolCall.name.trim().toLowerCase() === 'message';
}

function canAppendToTurn(
    entry: TranscriptTurnEntry,
    item: TranscriptItem,
    participant: 'agent' | 'user',
    key: string
) {
    if (entry.participant !== participant) {
        return false;
    }

    const previous = entry.items.at(-1);

    if (canAppendAgentActivity(entry, item, previous)) {
        return true;
    }

    if (entry.key !== key) {
        return false;
    }

    if (previous && hasExplicitConnection(item, previous)) {
        return true;
    }

    const currentTimestamp = parseTimestamp(getItemTimestamp(item));
    const previousTimestamp = parseTimestamp(previous ? getItemTimestamp(previous) : null);

    return Math.abs(currentTimestamp - previousTimestamp) <= turnMaxGapMs;
}

function canAppendAgentActivity(
    entry: TranscriptTurnEntry,
    item: TranscriptItem,
    previous: TranscriptItem | undefined
) {
    if (entry.participant !== 'agent' || !(isActivityItem(item) || isActivityItem(previous))) {
        return false;
    }

    const entryActorKey = getActorKey(entry.actor);
    const itemActorKey = getActorKey(getItemActor(item));

    if (entryActorKey !== itemActorKey && entryActorKey !== null && itemActorKey !== null) {
        return false;
    }

    const currentTimestamp = parseTimestamp(getItemTimestamp(item));
    const previousTimestamp = parseTimestamp(previous ? getItemTimestamp(previous) : null);

    return Math.abs(currentTimestamp - previousTimestamp) <= turnMaxGapMs;
}

function isActivityItem(item: TranscriptItem | undefined) {
    if (!item) {
        return false;
    }

    if (item.kind !== 'row') {
        return item.kind === 'failure';
    }

    return item.row.kind !== 'message';
}

function hasExplicitConnection(current: TranscriptItem, previous: TranscriptItem) {
    if (current.kind !== 'row' || previous.kind !== 'row') {
        return false;
    }

    if (current.row.kind === 'system' || previous.row.kind === 'system') {
        return false;
    }

    return current.row.connectsToPrevious && previous.row.connectsToNext;
}

function getItemParticipant(item: TranscriptItem): 'agent' | 'system' | 'user' {
    if (item.kind === 'activeReply' || item.kind === 'activeStatus' || item.kind === 'failure') {
        return 'agent';
    }

    const { row } = item;

    if (row.kind === 'message') {
        return row.message.senderType === 'user' ? 'user' : 'agent';
    }

    if (row.kind === 'tool' || row.kind === 'worker') {
        return row.sessionKey?.trim() || row.actor?.kind === 'agent' ? 'agent' : 'system';
    }

    if (row.systemKind === 'runtimeNotice') {
        return 'system';
    }

    return 'agent';
}

function getTurnKey(item: TranscriptItem, participant: 'agent' | 'user') {
    return `${participant}:${getItemActorKey(item)}:${getItemSessionKey(item) ?? 'no-session'}`;
}

function getItemActor(item: TranscriptItem): TranscriptActor {
    if (item.kind === 'activeReply' || item.kind === 'activeStatus') {
        return { id: item.reply.agentId, kind: 'agent' };
    }

    if (item.kind === 'failure') {
        return { id: item.failure.turn.agentId, kind: 'agent' };
    }

    if (item.row.kind !== 'system') {
        return item.row.actor;
    }

    return null;
}

function getItemActorKey(item: TranscriptItem) {
    return getActorKey(getItemActor(item)) ?? 'system';
}

function getActorKey(actor: TranscriptActor) {
    if (actor) {
        return `${actor.kind}:${actor.id}`;
    }
    return null;
}

export function getItemSessionKey(item: TranscriptItem) {
    if (item.kind === 'activeReply' || item.kind === 'activeStatus') {
        return item.reply.sessionKey;
    }

    if (item.kind === 'failure') {
        return item.failure.turn.sessionKey;
    }

    const { row } = item;

    if (row.kind === 'message') {
        const sessionKey = row.message.sourceSessionKey.trim();
        return sessionKey.length > 0 ? sessionKey : null;
    }

    if (row.kind === 'tool' || row.kind === 'worker') {
        return row.sessionKey;
    }

    return null;
}

export function getItemTimestamp(item: TranscriptItem) {
    if (item.kind === 'activeReply' || item.kind === 'activeStatus') {
        return item.reply.startedAt;
    }

    if (item.kind === 'failure') {
        return item.failure.turn.startedAt;
    }

    const { row } = item;

    if (row.kind === 'message') {
        return row.message.timestamp;
    }

    if (row.kind === 'tool' || row.kind === 'worker') {
        return row.startedAt ?? row.completedAt;
    }

    return row.timestamp;
}

function getRowSessionKey(row: TranscriptRow) {
    if (row.kind === 'tool' || row.kind === 'worker') {
        return row.sessionKey?.trim() ?? '';
    }

    return '';
}

function getRowTimestamp(row: TranscriptRow) {
    if (row.kind === 'message') {
        return row.message.timestamp;
    }

    if (row.kind === 'tool' || row.kind === 'worker') {
        return row.startedAt ?? row.completedAt;
    }

    return row.timestamp;
}

function parseTimestamp(timestamp: string | null) {
    const parsed = timestamp ? Date.parse(timestamp) : Number.NaN;
    return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
}
