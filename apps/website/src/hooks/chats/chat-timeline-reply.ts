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

export function mergeActiveReplySnapshot(
    current: ChatActiveReply | null,
    incoming: ChatActiveReply | null
): ChatActiveReply | null {
    if (!(current && incoming) || current.runId !== incoming.runId) {
        return incoming;
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
        text: incomingText.length === 0 && currentText.length > 0 ? currentText : incomingText,
    };
}

export function isSameActiveReplyRun(left: ChatActiveReply | null, right: ChatActiveReply | null) {
    return left?.runId === right?.runId;
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
    if (row.message.senderType !== 'agent') {
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
