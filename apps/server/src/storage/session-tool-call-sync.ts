import type { AgentRuntimeSessionGraph } from '@tavern/api';
import { and, inArray, notInArray } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { sessionToolCallsTable } from '../db/schema.ts';

type SessionToolCallInsert = typeof sessionToolCallsTable.$inferInsert;
type RuntimeToolCall = AgentRuntimeSessionGraph['toolCalls'][number];

export async function syncSessionToolCallsForRuntime(input: {
    runtimeId: string;
    runtimeSessionKeys: string[];
    syncedAt: string;
    toolCalls: RuntimeToolCall[];
}) {
    const sessionKeys = [...new Set(input.runtimeSessionKeys)];
    const recordsById = new Map<string, SessionToolCallInsert>();

    for (const toolCall of input.toolCalls) {
        const record = buildSessionToolCallRecord({
            syncedAt: input.syncedAt,
            toolCall,
        });

        recordsById.set(record.id, record);
    }

    const records = [...recordsById.values()];

    await deleteStaleToolCalls({
        records,
        sessionKeys,
    });

    for (const record of records) {
        await db
            .insert(sessionToolCallsTable)
            .values(record)
            .onConflictDoUpdate({
                target: sessionToolCallsTable.id,
                set: {
                    agentId: record.agentId,
                    argumentsJson: record.argumentsJson,
                    childSessionKey: record.childSessionKey,
                    finishedAt: record.finishedAt,
                    isError: record.isError,
                    messageId: record.messageId,
                    rawJson: record.rawJson,
                    resultJson: record.resultJson,
                    runId: record.runId,
                    sessionKey: record.sessionKey,
                    startedAt: record.startedAt,
                    toolCallId: record.toolCallId,
                    toolName: record.toolName,
                    updatedAt: record.updatedAt,
                },
            });
    }

    return { synced: records.length };
}

function buildSessionToolCallRecord(input: {
    syncedAt: string;
    toolCall: RuntimeToolCall;
}): SessionToolCallInsert {
    const sessionKey = input.toolCall.sessionKey;

    return {
        agentId: getRecordString(input.toolCall.arguments, 'agentId'),
        argumentsJson: JSON.stringify(input.toolCall.arguments),
        childSessionKey: input.toolCall.childSessionKey,
        finishedAt: input.toolCall.finishedAt,
        id: input.toolCall.id,
        isError: input.toolCall.isError,
        messageId: input.toolCall.messageId ?? null,
        rawJson: JSON.stringify(input.toolCall),
        resultJson: JSON.stringify(input.toolCall.result),
        runId: getRecordString(input.toolCall.result, 'runId'),
        sessionKey,
        startedAt: input.toolCall.startedAt,
        toolCallId: input.toolCall.toolCallId,
        toolName: input.toolCall.toolName,
        updatedAt: input.syncedAt,
    };
}

async function deleteStaleToolCalls(input: {
    records: SessionToolCallInsert[];
    sessionKeys: string[];
}) {
    if (input.sessionKeys.length === 0) {
        return;
    }

    const recordIds = input.records.map((record) => record.id);

    if (recordIds.length === 0) {
        await db
            .delete(sessionToolCallsTable)
            .where(inArray(sessionToolCallsTable.sessionKey, input.sessionKeys));
        return;
    }

    await db
        .delete(sessionToolCallsTable)
        .where(
            and(
                inArray(sessionToolCallsTable.sessionKey, input.sessionKeys),
                notInArray(sessionToolCallsTable.id, recordIds)
            )
        );
}

function getRecordString(value: unknown, key: string) {
    if (!(value && typeof value === 'object' && !Array.isArray(value))) {
        return null;
    }

    const candidate = (value as Record<string, unknown>)[key];

    return typeof candidate === 'string' && candidate.trim().length > 0 ? candidate.trim() : null;
}
