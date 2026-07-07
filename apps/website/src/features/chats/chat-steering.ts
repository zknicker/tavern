import type { ChatTimeline } from '../../hooks/chats/chat-timeline-state.ts';

export interface SteerableTurnTarget {
    agentId: string;
    runId: string;
}

// Live runs a queued draft could steer into: active turns plus streaming
// replies that have not completed and have no durable reply yet.
export function getSteerableTurnTargets(input: {
    activeReplies: readonly { agentId: string; completedAt?: string | null; runId: string }[];
    activeTurns: readonly { agentId: string; runId: string }[];
    rows?: ChatTimeline;
}): SteerableTurnTarget[] {
    const targets = new Map<string, SteerableTurnTarget>();

    for (const turn of input.activeTurns) {
        targets.set(turn.runId, { agentId: turn.agentId, runId: turn.runId });
    }

    for (const reply of input.activeReplies) {
        if (!reply.completedAt) {
            targets.set(reply.runId, { agentId: reply.agentId, runId: reply.runId });
        }
    }

    return [...targets.values()].filter(
        (target) =>
            !(
                input.activeReplies.some(
                    (reply) => reply.runId === target.runId && reply.completedAt
                ) || hasAgentMessageForRun(input.rows ?? [], target.runId)
            )
    );
}

// One live run is an unambiguous target. With several, a draft that mentions
// exactly one of the running agents steers that agent's run; anything else
// stays queued for the next turn.
export function resolveSteerRunId(
    targets: readonly SteerableTurnTarget[],
    input: { mentionAgentIds?: readonly string[] } = {}
): string | null {
    if (targets.length === 1) {
        return targets[0]?.runId ?? null;
    }

    const mentioned = new Set(input.mentionAgentIds ?? []);

    if (mentioned.size === 0) {
        return null;
    }

    const mentionedTargets = targets.filter((target) => mentioned.has(target.agentId));
    const mentionedAgents = new Set(mentionedTargets.map((target) => target.agentId));

    return mentionedAgents.size === 1 && mentionedTargets.length === 1
        ? (mentionedTargets[0]?.runId ?? null)
        : null;
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
