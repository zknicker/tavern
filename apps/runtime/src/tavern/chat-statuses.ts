import type { AgentRuntimeChatStatus, TavernResponseActivity } from '@tavern/api';
import { getDb } from '../db/connection';
import { namedParams } from '../db/sqlite';
import type { ActivityRow, ResponseRow } from './chat-api/types';

export function listTavernActiveChannelStatuses(): AgentRuntimeChatStatus[] {
    const db = getDb();
    const responses = db
        .prepare(
            `SELECT *
             FROM chat_responses
             WHERE status IN ('queued', 'running')
             ORDER BY updated_at DESC, id ASC`
        )
        .all() as ResponseRow[];

    return responses.map((response) => responseToChatStatus(response, db));
}

function responseToChatStatus(response: ResponseRow, db: ReturnType<typeof getDb>) {
    const metadata = JSON.parse(response.metadata_json) as Record<string, unknown>;
    const startedAt = metadataRuntimeString(metadata, 'startedAt') ?? response.created_at;
    const sessionKey = metadataRuntimeString(metadata, 'sessionKey') ?? response.id;
    const runId = metadataRuntimeString(metadata, 'runId') ?? response.id;
    const activities = db
        .prepare(
            `SELECT *
             FROM chat_response_activity
             WHERE response_id = $responseId
             ORDER BY sequence ASC`
        )
        .all(namedParams({ responseId: response.id })) as ActivityRow[];
    const steps = activities.map(activityToProgressStep);

    return {
        activeReply: {
            agentId: metadataRuntimeString(metadata, 'agentId') ?? response.participant_id,
            isThinking: true,
            runId,
            sessionKey,
            startedAt,
            text: response.summary ?? '',
        },
        ...(steps.length > 0
            ? {
                  activeReplyProgressStartedAt: steps[0]?.startedAt ?? response.updated_at,
                  activeReplySteps: steps.map(({ startedAt: _startedAt, ...step }) => step),
              }
            : {}),
        chatId: response.chat_id,
    } satisfies AgentRuntimeChatStatus;
}

function activityToProgressStep(row: ActivityRow) {
    const metadata = JSON.parse(row.metadata_json) as Record<string, unknown>;
    return {
        ...(row.detail ? { detail: row.detail } : {}),
        ...(metadataRuntimeString(metadata, 'toolCallId')
            ? { toolCallId: metadataRuntimeString(metadata, 'toolCallId') ?? undefined }
            : {}),
        ...(metadataRuntimeString(metadata, 'toolName')
            ? { toolName: metadataRuntimeString(metadata, 'toolName') ?? undefined }
            : {}),
        id: row.id,
        kind: activityKind(row.kind),
        label: row.title,
        startedAt: row.started_at,
        status: activityStatus(row.status),
    };
}

function activityKind(kind: TavernResponseActivity['kind']) {
    if (kind === 'reasoning') {
        return 'reasoning' as const;
    }
    if (kind === 'planning') {
        return 'plan' as const;
    }
    if (kind === 'command') {
        return 'command' as const;
    }
    if (kind === 'message') {
        return 'message' as const;
    }
    return 'tool' as const;
}

function activityStatus(status: TavernResponseActivity['status']) {
    if (status === 'completed') {
        return 'completed' as const;
    }
    if (status === 'failed') {
        return 'failed' as const;
    }
    return 'active' as const;
}

function metadataRuntimeString(metadata: Record<string, unknown>, key: string) {
    const runtime = metadata.runtime;

    if (!(runtime && typeof runtime === 'object' && !Array.isArray(runtime))) {
        return null;
    }

    const value = (runtime as Record<string, unknown>)[key];
    return typeof value === 'string' ? value : null;
}
