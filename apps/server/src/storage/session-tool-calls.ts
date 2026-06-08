import type { AgentRuntimeSessionGraph } from '@tavern/api';
import { inArray } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { sessionToolCallsTable } from '../db/schema.ts';

export type SessionToolCall = AgentRuntimeSessionGraph['toolCalls'][number];

export async function listSessionToolCalls(sessionKeys: string[]): Promise<SessionToolCall[]> {
    if (sessionKeys.length === 0) {
        return [];
    }

    const rows = await db
        .select()
        .from(sessionToolCallsTable)
        .where(inArray(sessionToolCallsTable.sessionKey, sessionKeys));

    return rows.map((row) => ({
        arguments: parseJson(row.argumentsJson),
        childSessionKey: row.childSessionKey,
        finishedAt: row.finishedAt,
        id: row.id,
        isError: row.isError,
        messageId: row.messageId,
        result: parseJson(row.resultJson),
        sessionKey: row.sessionKey,
        startedAt: row.startedAt,
        toolCallId: row.toolCallId,
        toolName: row.toolName,
    }));
}

function parseJson(value: string | null) {
    if (!value) {
        return null;
    }

    try {
        return JSON.parse(value) as unknown;
    } catch {
        return null;
    }
}
