import type { AgentRuntimeSession } from '@tavern/api';
import { desc, eq } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { sessionRunsTable } from '../db/schema.ts';
import { getActiveRuntimeId } from './agent-runtime-connections.ts';

export type SessionRecord = typeof sessionRunsTable.$inferSelect;

export function mapSessionFromRuntime(input: {
    runtimeId: string;
    session: AgentRuntimeSession;
}): AgentRuntimeSession {
    return {
        ...input.session,
        agentId: input.session.agentId,
        chatId: input.session.chatId,
        key: input.session.key,
        parentSessionKey: input.session.parentSessionKey,
    };
}

export async function listSessionRecords(options?: {
    includeInactive?: boolean;
    runtimeId?: string;
}) {
    const runtimeId = options?.includeInactive
        ? null
        : (options?.runtimeId ?? (await getActiveRuntimeId()));
    const query = db.select().from(sessionRunsTable);
    const scopedQuery = runtimeId ? query.where(eq(sessionRunsTable.runtime, runtimeId)) : query;

    return await scopedQuery.orderBy(
        desc(sessionRunsTable.updatedAt),
        desc(sessionRunsTable.sessionKey)
    );
}

export async function getSessionRecord(sessionKey: string) {
    const [session] = await db
        .select()
        .from(sessionRunsTable)
        .where(eq(sessionRunsTable.sessionKey, sessionKey))
        .limit(1);

    return session ?? null;
}

export async function syncSessionsForRuntime(input: {
    runtimeId: string;
    sessions: AgentRuntimeSession[];
    syncedAt?: string;
}) {
    const timestamp = input.syncedAt ?? new Date().toISOString();

    for (const session of input.sessions) {
        const runtimeSession = mapSessionFromRuntime({
            runtimeId: input.runtimeId,
            session,
        });

        await db
            .insert(sessionRunsTable)
            .values({
                agentId: runtimeSession.agentId,
                deliveryContextJson: null,
                finishedAt: null,
                id: runtimeSession.key,
                label: runtimeSession.title,
                mode: runtimeSession.sessionRole,
                parentSessionKey: runtimeSession.parentSessionKey,
                payloadJson: JSON.stringify({
                    lastSyncedAt: timestamp,
                    runtimeSession: session,
                }),
                runtime: input.runtimeId,
                sessionId: session.sessionId,
                sessionKey: runtimeSession.key,
                spawnedBy: runtimeSession.parentSessionKey,
                spawnedByMessageId: null,
                spawnedByToolCallId: null,
                startedAt: runtimeSession.startedAt,
                status: 'idle',
                thinkingLevel: null,
                updatedAt: runtimeSession.lastActivityAt ?? runtimeSession.startedAt ?? timestamp,
            })
            .onConflictDoUpdate({
                target: sessionRunsTable.id,
                set: {
                    agentId: runtimeSession.agentId,
                    label: runtimeSession.title,
                    mode: runtimeSession.sessionRole,
                    parentSessionKey: runtimeSession.parentSessionKey,
                    payloadJson: JSON.stringify({
                        lastSyncedAt: timestamp,
                        runtimeSession: session,
                    }),
                    runtime: input.runtimeId,
                    sessionId: session.sessionId,
                    sessionKey: runtimeSession.key,
                    spawnedBy: runtimeSession.parentSessionKey,
                    startedAt: runtimeSession.startedAt,
                    status: 'idle',
                    updatedAt: runtimeSession.lastActivityAt ?? runtimeSession.startedAt ?? timestamp,
                },
            });
    }

    return {
        synced: input.sessions.length,
    };
}

export function parseSessionRuntimePayload(session: SessionRecord) {
    const parsed = JSON.parse(session.payloadJson) as {
        lastSyncedAt?: string;
        runtimeSession?: Partial<AgentRuntimeSession>;
    };

    if (!parsed.runtimeSession) {
        return null;
    }

    const sessionId = parsed.runtimeSession.sessionId ?? session.sessionId;

    if (!sessionId) {
        return null;
    }

    return {
        ...parsed.runtimeSession,
        sessionId,
    } as AgentRuntimeSession;
}

export function parseSessionRecord(session: SessionRecord) {
    const runtimeId = session.runtime;
    const runtimeSession = parseSessionRuntimePayload(session);

    if (!(runtimeId && runtimeSession)) {
        return null;
    }

    return mapSessionFromRuntime({
        runtimeId,
        session: runtimeSession,
    });
}
