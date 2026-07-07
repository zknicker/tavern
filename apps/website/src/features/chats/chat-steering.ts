import type { ChatTimeline } from '../../hooks/chats/chat-timeline-state.ts';

// A queued draft can be steered only when the target is unambiguous: exactly
// one live run. With several agents mid-turn there is no single "the" turn to
// steer into, so the draft stays queued for the next turn instead.
export function getSteerableRunId(input: {
    activeReplies: readonly { completedAt?: string | null; runId: string }[];
    activeTurns: readonly { runId: string }[];
    rows?: ChatTimeline;
}) {
    const candidates = new Set<string>();

    for (const turn of input.activeTurns) {
        candidates.add(turn.runId);
    }

    for (const reply of input.activeReplies) {
        if (!reply.completedAt) {
            candidates.add(reply.runId);
        }
    }

    const steerable = [...candidates].filter(
        (runId) =>
            !(
                input.activeReplies.some((reply) => reply.runId === runId && reply.completedAt) ||
                hasAgentMessageForRun(input.rows ?? [], runId)
            )
    );

    return steerable.length === 1 ? (steerable[0] ?? null) : null;
}

// Every live run the user can act on (stop): active turns plus streaming
// replies that have not completed.
export function getActiveRunIds(timeline: {
    activeReplies: readonly { completedAt?: string | null; runId: string }[];
    activeTurns: readonly { runId: string }[];
}) {
    const runIds = new Set<string>();

    for (const turn of timeline.activeTurns) {
        runIds.add(turn.runId);
    }

    for (const reply of timeline.activeReplies) {
        if (!reply.completedAt) {
            runIds.add(reply.runId);
        }
    }

    return [...runIds];
}

function hasAgentMessageForRun(rows: ChatTimeline, runId: string) {
    return rows.some((row) => {
        if (row.kind !== 'message' || row.message.senderType !== 'agent') {
            return false;
        }

        if (isActivityMessageRow(row)) {
            return false;
        }

        return runtimeRunId(row.message.metadata) === runId;
    });
}

function isActivityMessageRow(row: Extract<ChatTimeline[number], { kind: 'message' }>) {
    return row.id.startsWith('act_');
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
