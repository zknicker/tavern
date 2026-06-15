import type { ChatTimeline } from '../../hooks/chats/chat-timeline-state.ts';

export function getSteerableRunId(input: {
    activeReply: { runId: string; text?: string | null } | null;
    activeTurn: { runId: string } | null;
    rows?: ChatTimeline;
}) {
    const runId = input.activeTurn?.runId ?? input.activeReply?.runId ?? null;

    if (!runId) {
        return null;
    }

    if ((input.activeReply?.text ?? '').trim().length > 0) {
        return null;
    }

    if (hasAgentMessageForRun(input.rows ?? [], runId)) {
        return null;
    }

    return runId;
}

function hasAgentMessageForRun(rows: ChatTimeline, runId: string) {
    return rows.some((row) => {
        if (row.kind !== 'message' || row.message.senderType !== 'agent') {
            return false;
        }

        return runtimeRunId(row.message.metadata) === runId;
    });
}

function runtimeRunId(metadata: unknown) {
    const record = readRecord(metadata);
    return readString(readRecord(record.runtime)?.runId);
}

function readRecord(value: unknown) {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
}

function readString(value: unknown) {
    return typeof value === 'string' ? value : null;
}
