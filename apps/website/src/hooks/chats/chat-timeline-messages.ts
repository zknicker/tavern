import type { ChatLogOutput } from '../../lib/trpc.tsx';

const sessionRailMaxGapMs = 5 * 60 * 1000;

type ChatLogRow = NonNullable<ChatLogOutput>['rows'][number];
type ChatMessageRow = Extract<ChatLogRow, { kind: 'message' }>;

export interface ChatTimelineMessage {
    content: string;
    id: string;
    metadata?: Record<string, unknown>;
    sessionKey?: string | null;
    timestamp: string;
}

function getRowTimestampMs(row: ChatLogRow) {
    const timestamp =
        row.kind === 'message'
            ? row.message.timestamp
            : row.kind === 'system'
              ? row.timestamp
              : row.kind === 'worker'
                ? (row.startedAt ??
                  row.completedAt ??
                  row.worker.lastEventAt ??
                  row.worker.createdAt)
                : (row.startedAt ?? row.completedAt);
    const parsed = timestamp ? Date.parse(timestamp) : Number.NaN;

    return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
}

function getRowSessionKey(row: ChatLogRow) {
    if (row.kind === 'message') {
        const sessionKey = row.message.sourceSessionKey.trim();
        return sessionKey.length > 0 ? sessionKey : null;
    }

    if (row.kind === 'tool') {
        return row.sessionKey;
    }

    if (row.kind === 'worker') {
        return row.sessionKey ?? row.worker.sessionKey;
    }

    return null;
}

function getActorKey(row: ChatLogRow | null) {
    if (!row || row.kind === 'system') {
        return null;
    }

    return row.actor ? `${row.actor.kind}:${row.actor.id}` : null;
}

function compareChatLogRows(left: ChatLogRow, right: ChatLogRow) {
    const timestampDelta = getRowTimestampMs(left) - getRowTimestampMs(right);

    return timestampDelta || getRowSortRank(left) - getRowSortRank(right);
}

function getRowSortRank(row: ChatLogRow) {
    if (row.kind === 'message') {
        return row.message.senderType === 'user' ? 0 : 2;
    }

    return 1;
}

function canConnectSessionRail(currentRow: ChatLogRow, adjacentRow: ChatLogRow | null) {
    if (!adjacentRow || currentRow.kind === 'system' || adjacentRow.kind === 'system') {
        return false;
    }

    const currentSessionKey = getRowSessionKey(currentRow);
    const adjacentSessionKey = getRowSessionKey(adjacentRow);

    if (!currentSessionKey || currentSessionKey !== adjacentSessionKey) {
        return false;
    }

    return (
        Math.abs(getRowTimestampMs(currentRow) - getRowTimestampMs(adjacentRow)) <=
        sessionRailMaxGapMs
    );
}

function buildUserMessageRow(input: {
    content: string;
    id: string;
    metadata?: Record<string, unknown>;
    sessionKey?: string | null;
    timestamp: string;
}): ChatMessageRow {
    const sourceSessionKey = input.sessionKey?.trim() ?? '';

    return {
        actor: null,
        connectsToNext: false,
        connectsToPrevious: false,
        id: input.id,
        isFirstInGroup: true,
        kind: 'message',
        message: {
            actor: null,
            content: input.content,
            id: input.id,
            metadata: input.metadata,
            sender: 'You',
            senderType: 'user',
            sourceSessionId: null,
            sourceSessionKey,
            timestamp: input.timestamp,
        },
    };
}

function createEmptyLog(limit: number): ChatLogOutput {
    return {
        limit,
        offset: 0,
        rows: [],
        total: 0,
    };
}

function isMatchingLoggedUserMessage(row: ChatMessageRow, message: ChatTimelineMessage) {
    return row.id === message.id || row.message.id === message.id;
}

function recomputeRowConnections(rows: ChatLogRow[]): ChatLogRow[] {
    return rows.map((row, index) => {
        if (row.kind === 'system') {
            return row;
        }

        const previousRow = rows[index - 1] ?? null;
        const nextRow = rows[index + 1] ?? null;
        const connectsToPrevious = canConnectSessionRail(row, previousRow);

        return {
            ...row,
            connectsToNext: canConnectSessionRail(row, nextRow),
            connectsToPrevious,
            isFirstInGroup: getActorKey(previousRow) !== getActorKey(row) || !connectsToPrevious,
        };
    });
}

export function appendTimelineMessage(
    current: ChatLogOutput | undefined,
    input: ChatTimelineMessage
) {
    if (!current || current.rows.some((row) => row.id === input.id)) {
        return current;
    }

    const nextRows = recomputeRowConnections(
        [...current.rows, buildUserMessageRow(input)].sort(compareChatLogRows)
    );
    const total = current.total + 1;

    return {
        ...current,
        offset: Math.max(total - current.limit, 0),
        rows: nextRows.slice(-current.limit),
        total,
    };
}

export function mergeTimelineMessages(input: {
    limit: number;
    logged: ChatLogOutput | undefined;
    messages: readonly ChatTimelineMessage[];
}) {
    if (!input.logged && input.messages.length === 0) {
        return undefined;
    }

    const initial = input.logged ?? createEmptyLog(input.limit);

    const merged = input.messages.reduce(
        (current, message) => appendTimelineMessage(current, message) ?? current,
        initial
    );

    return {
        ...merged,
        rows: recomputeRowConnections([...merged.rows].sort(compareChatLogRows)),
    };
}

export function getLoggedTimelineMessageIds(
    logged: ChatLogOutput | undefined,
    messages: readonly ChatTimelineMessage[]
) {
    if (!logged || messages.length === 0) {
        return [];
    }

    const loggedUserRows = logged.rows.filter(
        (row): row is ChatMessageRow => row.kind === 'message' && row.message.senderType === 'user'
    );
    const confirmedIds: string[] = [];
    let searchStart = 0;

    for (const message of messages) {
        for (let index = searchStart; index < loggedUserRows.length; index += 1) {
            if (!isMatchingLoggedUserMessage(loggedUserRows[index], message)) {
                continue;
            }

            confirmedIds.push(message.id);
            searchStart = index + 1;
            break;
        }
    }

    return confirmedIds;
}
