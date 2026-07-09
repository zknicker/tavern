import { hasLoggedTurnFailure } from './chat-timeline-failures.ts';
import { getTimestampMs } from './chat-timeline-time.ts';
import type {
    ChatActiveReply,
    ChatTimeline,
    ChatTimelineMessageRow,
} from './chat-timeline-types.ts';

const activeReplyHandoffToleranceMs = 30 * 1000;

export function hasAssistantReplyForActiveTurn(
    rows: ChatTimeline,
    activeReply: ChatActiveReply | null
) {
    if (!activeReply) {
        return false;
    }

    return hasDurableAssistantReply(rows, activeReply);
}

export function getTerminalAssistantReplyTimestamp(
    rows: ChatTimeline,
    activeReply: ChatActiveReply
) {
    for (let index = rows.length - 1; index >= 0; index -= 1) {
        const row = rows[index];

        if (row.kind !== 'message' || !isDurableReplyForActiveReply(row, activeReply)) {
            continue;
        }

        return row.message.timestamp;
    }

    return null;
}

export function isSameActiveReply(left: ChatActiveReply | null, right: ChatActiveReply | null) {
    if (left === right) {
        return true;
    }

    if (!(left && right)) {
        return false;
    }

    return (
        left.agentId === right.agentId &&
        (left.completedAt ?? null) === (right.completedAt ?? null) &&
        (left.isThinking ?? true) === (right.isThinking ?? true) &&
        left.runId === right.runId &&
        left.sessionKey === right.sessionKey &&
        left.startedAt === right.startedAt &&
        (left.statusSequence ?? null) === (right.statusSequence ?? null) &&
        (left.text ?? '') === (right.text ?? '')
    );
}

export function normalizeActiveReply(activeReply: ChatActiveReply | null): ChatActiveReply | null {
    if (!activeReply) {
        return null;
    }

    return {
        ...activeReply,
        isThinking: activeReply.isThinking ?? true,
        text: activeReply.text ?? '',
    };
}

export interface ActiveReplyMergeOptions {
    /**
     * Live turn events own the reply verbatim, including resets to empty
     * text. Snapshot merges (log refetches) must never regress streamed text.
     */
    authoritative?: boolean;
}

export function mergeActiveReplySnapshot(
    current: ChatActiveReply | null,
    incoming: ChatActiveReply | null,
    options: ActiveReplyMergeOptions = {}
): ChatActiveReply | null {
    if (!(current && incoming) || current.runId !== incoming.runId) {
        return incoming;
    }

    if (options.authoritative) {
        return {
            ...incoming,
            completedAt: incoming.completedAt ?? current.completedAt ?? null,
            statusSequence: incoming.statusSequence ?? current.statusSequence ?? null,
        };
    }

    const currentText = current.text ?? '';
    const incomingText = incoming.text ?? '';

    return {
        ...incoming,
        isThinking:
            current.isThinking === false && incoming.isThinking !== false
                ? false
                : incoming.isThinking,
        completedAt: incoming.completedAt ?? current.completedAt ?? null,
        statusSequence: incoming.statusSequence ?? current.statusSequence ?? null,
        text: incomingText.length >= currentText.length ? incomingText : currentText,
    };
}

export function findActiveReply(replies: readonly ChatActiveReply[], runId: string) {
    return replies.find((reply) => reply.runId === runId) ?? null;
}

// Replace-by-runId or insert, keeping startedAt order so render order is
// stable across upserts. Returns the same array when nothing changed.
export function upsertActiveReply(
    replies: readonly ChatActiveReply[],
    reply: ChatActiveReply
): ChatActiveReply[] {
    const existing = findActiveReply(replies, reply.runId);

    if (existing && isSameActiveReply(existing, reply)) {
        return replies as ChatActiveReply[];
    }

    return sortActiveReplies([...replies.filter((entry) => entry.runId !== reply.runId), reply]);
}

export function removeActiveReply(
    replies: readonly ChatActiveReply[],
    runId: string
): ChatActiveReply[] {
    const next = replies.filter((reply) => reply.runId !== runId);

    return next.length === replies.length ? (replies as ChatActiveReply[]) : next;
}

export function areSameActiveReplies(
    left: readonly ChatActiveReply[],
    right: readonly ChatActiveReply[]
) {
    if (left === right) {
        return true;
    }

    if (left.length !== right.length) {
        return false;
    }

    return left.every((reply, index) => isSameActiveReply(reply, right[index] ?? null));
}

function sortActiveReplies(replies: ChatActiveReply[]) {
    return replies.sort(
        (left, right) =>
            (getTimestampMs(left.startedAt) ?? 0) - (getTimestampMs(right.startedAt) ?? 0) ||
            left.runId.localeCompare(right.runId)
    );
}

function hasDurableAssistantReply(rows: ChatTimeline, activeReply: ChatActiveReply) {
    for (let index = rows.length - 1; index >= 0; index -= 1) {
        const row = rows[index];

        if (row.kind !== 'message') {
            continue;
        }

        if (isDurableReplyForActiveReply(row, activeReply)) {
            return true;
        }
    }

    return false;
}

function isDurableReplyForActiveReply(row: ChatTimelineMessageRow, activeReply: ChatActiveReply) {
    // Activity rows projected as messages (narration, progress updates) are
    // work-log evidence, not the turn's durable reply. Matching them here
    // would kill the streaming reply as soon as the agent narrates mid-turn.
    if (row.message.senderType !== 'agent' || isActivityMessageRow(row)) {
        return false;
    }

    if (getMessageRuntimeRunId(row) === activeReply.runId) {
        return true;
    }

    if (
        !(
            hasCompatibleAssistantIdentity(row, activeReply) &&
            hasCompatibleSession(row, activeReply)
        )
    ) {
        return false;
    }

    const messageTimestamp = getTimestampMs(row.message.timestamp);
    const activeStartedAt = getTimestampMs(activeReply.startedAt);

    if (
        messageTimestamp !== null &&
        activeStartedAt !== null &&
        messageTimestamp >= activeStartedAt
    ) {
        return true;
    }

    const activeText = normalizeReplyText(activeReply.text);

    if (activeText.length === 0 || normalizeReplyText(row.message.content) !== activeText) {
        return false;
    }

    if (messageTimestamp === null || activeStartedAt === null) {
        return true;
    }

    return activeStartedAt - messageTimestamp <= activeReplyHandoffToleranceMs;
}

function hasCompatibleAssistantIdentity(row: ChatTimelineMessageRow, activeReply: ChatActiveReply) {
    if (row.actor?.kind === 'agent' && row.actor.id !== activeReply.agentId) {
        return false;
    }

    if (row.message.tavernAgentId && row.message.tavernAgentId !== activeReply.agentId) {
        return false;
    }

    return true;
}

function hasCompatibleSession(row: ChatTimelineMessageRow, activeReply: ChatActiveReply) {
    const activeSessionKey = activeReply.sessionKey.trim();
    const rowSessionKey = row.message.sourceSessionKey.trim();

    return !(activeSessionKey && rowSessionKey && activeSessionKey !== rowSessionKey);
}

function getMessageRuntimeRunId(row: ChatTimelineMessageRow) {
    return getRuntimeMetadataString(row.message.metadata, 'runId');
}

function isActivityMessageRow(row: ChatTimelineMessageRow) {
    return row.id.startsWith('act_');
}

function getRuntimeMetadataString(
    metadata: Record<string, unknown> | null | undefined,
    key: string
) {
    const runtime = metadata?.runtime;

    if (!(runtime && typeof runtime === 'object' && !Array.isArray(runtime))) {
        return null;
    }

    const value = (runtime as Record<string, unknown>)[key];
    return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function normalizeReplyText(text: string | null | undefined) {
    return text?.trim() ?? '';
}

export function hasTerminalReplyOrFailure(input: {
    activeReply: ChatActiveReply | null;
    rows: ChatTimeline;
}) {
    return (
        hasAssistantReplyForActiveTurn(input.rows, input.activeReply) ||
        Boolean(input.activeReply && hasLoggedTurnFailure(input.rows, input.activeReply.runId))
    );
}
