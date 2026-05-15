import type { AgentRuntimeSession } from '@tavern/agent-runtime-protocol';
import { desc, eq } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { sessionRunsTable } from '../db/schema.ts';
import { getActiveProjectionRuntimeId } from './agent-runtime-connections.ts';

export type SessionProjection = typeof sessionRunsTable.$inferSelect;

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

export async function listSessionProjections(options?: {
    includeInactive?: boolean;
    runtimeId?: string;
}) {
    const runtimeId = options?.includeInactive
        ? null
        : (options?.runtimeId ?? (await getActiveProjectionRuntimeId()));
    const query = db.select().from(sessionRunsTable);
    const scopedQuery = runtimeId ? query.where(eq(sessionRunsTable.runtime, runtimeId)) : query;

    return await scopedQuery.orderBy(
        desc(sessionRunsTable.updatedAt),
        desc(sessionRunsTable.sessionKey)
    );
}

export async function getSessionProjection(sessionKey: string) {
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
        const projected = mapSessionFromRuntime({
            runtimeId: input.runtimeId,
            session,
        });

        await db
            .insert(sessionRunsTable)
            .values({
                agentId: projected.agentId,
                deliveryContextJson: null,
                finishedAt: null,
                id: projected.key,
                label: projected.title,
                mode: projected.sessionRole,
                parentSessionKey: projected.parentSessionKey,
                payloadJson: JSON.stringify({
                    lastSyncedAt: timestamp,
                    runtimeSession: session,
                }),
                runtime: input.runtimeId,
                sessionId: session.sessionId,
                sessionKey: projected.key,
                spawnedBy: projected.parentSessionKey,
                spawnedByMessageId: null,
                spawnedByToolCallId: null,
                startedAt: projected.startedAt,
                status: 'idle',
                thinkingLevel: null,
                updatedAt: projected.lastActivityAt ?? projected.startedAt ?? timestamp,
            })
            .onConflictDoUpdate({
                target: sessionRunsTable.id,
                set: {
                    agentId: projected.agentId,
                    label: projected.title,
                    mode: projected.sessionRole,
                    parentSessionKey: projected.parentSessionKey,
                    payloadJson: JSON.stringify({
                        lastSyncedAt: timestamp,
                        runtimeSession: session,
                    }),
                    runtime: input.runtimeId,
                    sessionId: session.sessionId,
                    sessionKey: projected.key,
                    spawnedBy: projected.parentSessionKey,
                    startedAt: projected.startedAt,
                    status: 'idle',
                    updatedAt: projected.lastActivityAt ?? projected.startedAt ?? timestamp,
                },
            });
    }

    return {
        synced: input.sessions.length,
    };
}

export function parseSessionRuntimePayload(session: SessionProjection) {
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

export function parseSessionProjection(session: SessionProjection) {
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
