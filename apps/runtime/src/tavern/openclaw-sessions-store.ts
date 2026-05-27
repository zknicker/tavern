import {
    type AgentRuntimeSession,
    type AgentRuntimeSessionGraph,
    type AgentRuntimeSessionMessage,
    agentRuntimeSessionGraphSchema,
    agentRuntimeSessionListSchema,
    agentRuntimeSessionMessageListSchema,
    agentRuntimeSessionResyncSchema,
    agentRuntimeSessionSchema,
} from '@tavern/api';
import { getDb } from '../db/connection';
import type { Database } from '../db/sqlite';
import { namedParams } from '../db/sqlite';

interface RawJsonRow {
    raw_json: string;
}

export function listStoredOpenClawSessions(db: Database = getDb()) {
    const rows = db
        .prepare('SELECT raw_json FROM openclaw_sessions ORDER BY updated_at DESC, session_key ASC')
        .all() as RawJsonRow[];

    return agentRuntimeSessionListSchema.parse({
        sessions: rows.map((row) => JSON.parse(row.raw_json)),
    });
}

export function getStoredOpenClawSession(sessionKey: string, db: Database = getDb()) {
    const row = db
        .prepare('SELECT raw_json FROM openclaw_sessions WHERE session_key = $sessionKey LIMIT 1')
        .get(namedParams({ sessionKey })) as RawJsonRow | null;

    return row ? agentRuntimeSessionSchema.parse(JSON.parse(row.raw_json)) : null;
}

export function listStoredOpenClawSessionMessages(
    sessionKey: string,
    options: { limit?: number } = {},
    db: Database = getDb()
) {
    const limit = Math.max(1, Math.min(options.limit ?? 200, 1000));
    const rows = db
        .prepare(
            `SELECT raw_json
             FROM openclaw_session_messages
             WHERE session_key = $sessionKey
             ORDER BY seq ASC, id ASC
             LIMIT $limit`
        )
        .all(namedParams({ limit, sessionKey })) as RawJsonRow[];

    return agentRuntimeSessionMessageListSchema.parse({
        messages: rows.map((row) => JSON.parse(row.raw_json)),
    });
}

export function getStoredOpenClawSessionGraph(sessionKey: string, db: Database = getDb()) {
    const row = db
        .prepare('SELECT raw_json FROM openclaw_session_graphs WHERE session_key = $sessionKey')
        .get(namedParams({ sessionKey })) as RawJsonRow | null;

    if (row) {
        return agentRuntimeSessionGraphSchema.parse(JSON.parse(row.raw_json));
    }

    const session = getStoredOpenClawSession(sessionKey, db);
    if (!session) {
        return null;
    }

    return agentRuntimeSessionGraphSchema.parse({
        artifacts: [],
        links: [],
        messages: listStoredOpenClawSessionMessages(sessionKey, {}, db).messages,
        rootSessionKey: sessionKey,
        sessions: [session],
        toolCalls: [],
    });
}

export function replaceStoredOpenClawSessions(input: {
    db?: Database;
    pruneMissing?: boolean;
    sessions: AgentRuntimeSession[];
    syncedAt?: string;
}) {
    const db = input.db ?? getDb();
    const syncedAt = input.syncedAt ?? new Date().toISOString();

    db.exec('BEGIN IMMEDIATE');
    try {
        for (const session of input.sessions) {
            db.prepare(
                `INSERT INTO openclaw_sessions (
                    session_key,
                    session_id,
                    agent_id,
                    chat_id,
                    platform,
                    raw_json,
                    last_synced_at,
                    created_at,
                    updated_at
                )
                VALUES (
                    $sessionKey,
                    $sessionId,
                    $agentId,
                    $chatId,
                    $platform,
                    $rawJson,
                    $lastSyncedAt,
                    $createdAt,
                    $updatedAt
                )
                ON CONFLICT(session_key) DO UPDATE SET
                    session_id = excluded.session_id,
                    agent_id = excluded.agent_id,
                    chat_id = excluded.chat_id,
                    platform = excluded.platform,
                    raw_json = excluded.raw_json,
                    last_synced_at = excluded.last_synced_at,
                    updated_at = excluded.updated_at`
            ).run(
                namedParams({
                    agentId: session.agentId,
                    chatId: session.chatId,
                    createdAt: syncedAt,
                    lastSyncedAt: syncedAt,
                    platform: session.platform,
                    rawJson: stableJson(session),
                    sessionId: session.sessionId,
                    sessionKey: session.key,
                    updatedAt: session.lastActivityAt ?? session.startedAt ?? syncedAt,
                })
            );
        }

        if (input.pruneMissing ?? true) {
            deleteMissingRows(
                db,
                'openclaw_sessions',
                'session_key',
                input.sessions.map((session) => session.key)
            );
        }
        db.exec('COMMIT');
    } catch (error) {
        db.exec('ROLLBACK');
        throw error;
    }

    return { synced: input.sessions.length };
}

export function replaceStoredOpenClawSessionMessages(input: {
    db?: Database;
    messagesBySessionKey: Map<string, AgentRuntimeSessionMessage[]>;
    syncedAt?: string;
}) {
    const db = input.db ?? getDb();
    const syncedAt = input.syncedAt ?? new Date().toISOString();
    let synced = 0;

    db.exec('BEGIN IMMEDIATE');
    try {
        for (const [sessionKey, messages] of input.messagesBySessionKey) {
            db.prepare('DELETE FROM openclaw_session_messages WHERE session_key = $sessionKey').run(
                namedParams({ sessionKey })
            );

            for (const [index, message] of messages.entries()) {
                db.prepare(
                    `INSERT INTO openclaw_session_messages (
                        id,
                        session_key,
                        seq,
                        timestamp,
                        raw_json,
                        last_synced_at
                    )
                    VALUES (
                        $id,
                        $sessionKey,
                        $seq,
                        $timestamp,
                        $rawJson,
                        $lastSyncedAt
                    )`
                ).run(
                    namedParams({
                        id: createStoredMessageId(sessionKey, index, message.id),
                        lastSyncedAt: syncedAt,
                        rawJson: stableJson(message),
                        seq: index,
                        sessionKey,
                        timestamp: message.timestamp,
                    })
                );
                synced += 1;
            }
        }
        db.exec('COMMIT');
    } catch (error) {
        db.exec('ROLLBACK');
        throw error;
    }

    return { synced };
}

export function replaceStoredOpenClawSessionGraphs(input: {
    db?: Database;
    graphs: AgentRuntimeSessionGraph[];
    syncedAt?: string;
}) {
    const db = input.db ?? getDb();
    const syncedAt = input.syncedAt ?? new Date().toISOString();

    db.exec('BEGIN IMMEDIATE');
    try {
        for (const graph of input.graphs) {
            db.prepare(
                `INSERT INTO openclaw_session_graphs (
                    session_key,
                    raw_json,
                    last_synced_at,
                    created_at,
                    updated_at
                )
                VALUES (
                    $sessionKey,
                    $rawJson,
                    $lastSyncedAt,
                    $createdAt,
                    $updatedAt
                )
                ON CONFLICT(session_key) DO UPDATE SET
                    raw_json = excluded.raw_json,
                    last_synced_at = excluded.last_synced_at,
                    updated_at = excluded.updated_at`
            ).run(
                namedParams({
                    createdAt: syncedAt,
                    lastSyncedAt: syncedAt,
                    rawJson: stableJson(graph),
                    sessionKey: graph.rootSessionKey,
                    updatedAt: syncedAt,
                })
            );
        }
        db.exec('COMMIT');
    } catch (error) {
        db.exec('ROLLBACK');
        throw error;
    }

    return { synced: input.graphs.length };
}

export function markStoredOpenClawSessionResynced(sessionKey: string) {
    return agentRuntimeSessionResyncSchema.parse({
        resynced: true,
        rootSessionKey: sessionKey,
        sessionKey,
    });
}

function deleteMissingRows(
    db: Database,
    tableName: 'openclaw_sessions',
    columnName: 'session_key',
    ids: string[]
) {
    if (ids.length === 0) {
        db.prepare(`DELETE FROM ${tableName}`).run();
        return;
    }

    const placeholders = ids.map(() => '?').join(', ');
    db.prepare(`DELETE FROM ${tableName} WHERE ${columnName} NOT IN (${placeholders})`).run(...ids);
}

function createStoredMessageId(sessionKey: string, index: number, messageId: string) {
    return `${sessionKey}:${index}:${messageId}`;
}

function stableJson(value: unknown) {
    return JSON.stringify(value);
}
