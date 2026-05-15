import type { AgentRuntimeSessionGraph } from '@tavern/agent-runtime-protocol';
import { inArray } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { sessionToolCallsTable } from '../db/schema.ts';

export type ProjectedSessionToolCall = AgentRuntimeSessionGraph['toolCalls'][number];

export async function listProjectedSessionToolCalls(
    sessionKeys: string[]
): Promise<ProjectedSessionToolCall[]> {
    if (sessionKeys.length === 0) {
        return [];
    }

    const rows = await db
        .select()
        .from(sessionToolCallsTable)
        .where(inArray(sessionToolCallsTable.sessionKey, sessionKeys));

    return rows.map((row) => ({
        arguments: parseProjectedJson(row.argumentsJson),
        childSessionKey: row.childSessionKey,
        finishedAt: row.finishedAt,
        id: row.id,
        isError: row.isError,
        messageId: row.messageId,
        result: parseProjectedJson(row.resultJson),
        sessionKey: row.sessionKey,
        startedAt: row.startedAt,
        toolCallId: row.toolCallId,
        toolName: row.toolName,
    }));
}

function parseProjectedJson(value: string | null) {
    if (!value) {
        return null;
    }

    try {
        return JSON.parse(value) as unknown;
    } catch {
        return null;
    }
}
