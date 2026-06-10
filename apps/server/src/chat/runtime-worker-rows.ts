import type { TavernResponseActivity } from '@tavern/sdk';
import type { Worker } from '../workers/contracts.ts';
import type { ChatLogPage } from './contracts.ts';

// Projects a spawn-tree activity (metadata.subagent source facts recorded by
// the runtime adapter) into a worker chat row. Returns null when the
// activity is missing the stable identity or timing a worker row requires —
// the caller falls back to plain tool-row presentation instead of inventing
// values.
export function workerRowFromSubagentActivity(input: {
    activity: TavernResponseActivity;
    actor: { id: string; kind: 'agent' };
    agentName: string | null;
    sessionKey: string | null;
}): Extract<ChatLogPage['rows'][number], { kind: 'worker' }> | null {
    const subagent = readRecord(input.activity.metadata.subagent);

    if (Object.keys(subagent).length === 0) {
        return null;
    }

    const subagentId = readString(subagent.subagentId);
    const startedAt = input.activity.started_at;

    if (!(subagentId && startedAt)) {
        return null;
    }

    const goal = readString(subagent.goal);
    const summary = readString(subagent.summary);
    const status = workerStatus(input.activity.status);
    const worker: Worker = {
        agentId: input.actor.id,
        agentName: input.agentName ?? input.actor.id,
        chatTitle: null,
        childSessionKey: null,
        cleanupAfter: null,
        createdAt: startedAt,
        deliveryStatus: null,
        description: goal,
        detail: input.activity.detail,
        endedAt: input.activity.completed_at,
        error: null,
        executionMode: 'unknown',
        id: subagentId,
        kind: 'subagent',
        lastEventAt: input.activity.updated_at,
        notifyPolicy: null,
        parentWorkerId: readString(subagent.parentId),
        progressSummary: summary ?? input.activity.detail,
        requesterSessionKey: input.sessionKey,
        runId: null,
        sessionKey: null,
        source: 'agentRuntime',
        sourceFlowId: null,
        sourceId: subagentId,
        startedAt,
        status,
        syncedAt: input.activity.updated_at,
        terminalSummary: status === 'running' ? null : summary,
        title: goal ?? input.activity.title,
    };

    return {
        actor: input.actor,
        completedAt: input.activity.completed_at,
        connectsToNext: false,
        connectsToPrevious: false,
        id: input.activity.id,
        isFirstInGroup: true,
        kind: 'worker',
        sessionKey: input.sessionKey,
        startedAt,
        worker,
    };
}

function workerStatus(status: TavernResponseActivity['status']): Worker['status'] {
    if (status === 'failed') {
        return 'failed';
    }
    if (status === 'completed') {
        return 'succeeded';
    }
    if (status === 'cancelled') {
        return 'cancelled';
    }
    return 'running';
}

function readRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
}

function readString(value: unknown) {
    return typeof value === 'string' && value.trim().length > 0 ? value : null;
}
