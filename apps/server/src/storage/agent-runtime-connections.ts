import { desc, eq } from 'drizzle-orm';
import type { AgentRuntimeConnectionAuth } from '../agent-runtime-connection/contracts.ts';
import {
    getEnvironmentAgentRuntimeConnection,
    saveEnvironmentAgentRuntimeConnection,
} from '../agent-runtime-connection/environment-override.ts';
import { databaseClient, db } from '../db/index.ts';
import { agentRuntimeConnectionsTable } from '../db/schema.ts';
import { formatSkillInventorySyncStateId } from './skills.ts';

export const managedOpenClawRuntimeId = 'tavern-openclaw-managed';
export const agentRuntimeConnectionId = managedOpenClawRuntimeId;

export async function listAgentRuntimeConnections() {
    const record = await getActiveAgentRuntimeConnection();
    return record ? [record] : [];
}

async function listAgentRuntimeConnectionRecords() {
    return await db
        .select()
        .from(agentRuntimeConnectionsTable)
        .orderBy(desc(agentRuntimeConnectionsTable.updatedAt));
}

export async function getLatestAgentRuntimeConnection() {
    return (await listAgentRuntimeConnectionRecords())[0] ?? null;
}

export async function listConfiguredAgentRuntimeConnections() {
    const environmentRecord = getEnvironmentAgentRuntimeConnection();
    if (environmentRecord?.enabled) {
        return [environmentRecord];
    }

    const record = await getActiveAgentRuntimeConnection();
    return record?.enabled ? [record] : [];
}

export async function listReachableAgentRuntimeConnections() {
    const environmentRecord = getEnvironmentAgentRuntimeConnection();
    if (environmentRecord) {
        if (
            environmentRecord.enabled &&
            environmentRecord.lastCheckedAt &&
            !environmentRecord.lastError
        ) {
            return [environmentRecord];
        }

        return [];
    }

    const record = await getActiveAgentRuntimeConnection();
    if (!(record?.enabled && record.lastCheckedAt)) {
        return [];
    }

    if (record.lastError) {
        return [];
    }

    return [record];
}

export async function getDefaultAgentRuntimeConnection() {
    const environmentRecord = getEnvironmentAgentRuntimeConnection();
    if (environmentRecord) {
        return environmentRecord;
    }

    return await getActiveAgentRuntimeConnection();
}

export async function getActiveAgentRuntimeConnection() {
    const environmentRecord = getEnvironmentAgentRuntimeConnection();
    if (environmentRecord) {
        return environmentRecord;
    }

    const records = await listAgentRuntimeConnectionRecords();
    return (
        records.find((record) => record.id === agentRuntimeConnectionId) ??
        records.find((record) => record.isActive) ??
        records[0] ??
        null
    );
}

export async function getActiveRuntimeId() {
    const connection =
        (await getActiveAgentRuntimeConnection()) ?? (await getLatestAgentRuntimeConnection());

    return connection?.id ?? inferLatestRuntimeId();
}

export async function getAgentRuntimeConnection(id: string) {
    const environmentRecord = getEnvironmentAgentRuntimeConnection();
    if (environmentRecord?.id === id) {
        return environmentRecord;
    }

    const [record] = await db
        .select()
        .from(agentRuntimeConnectionsTable)
        .where(eq(agentRuntimeConnectionsTable.id, id))
        .limit(1);

    return record ?? null;
}

export async function saveAgentRuntimeConnection(input: {
    auth?: AgentRuntimeConnectionAuth | null;
    baseUrl: string;
    enabled?: boolean;
    id?: string;
    isActive?: boolean;
    lastCheckedAt: string | null;
    lastError: string | null;
    lastSyncedAt?: string | null;
    name: string;
}) {
    const timestamp = new Date().toISOString();
    const existingById = input.id ? await getAgentRuntimeConnection(input.id) : null;
    const existing = existingById ?? (await getAgentRuntimeConnection(agentRuntimeConnectionId));
    const id = input.id ?? existing?.id ?? agentRuntimeConnectionId;
    const isActive = input.isActive ?? existing?.isActive ?? true;
    const authJson = input.auth ? JSON.stringify(input.auth) : null;
    const updateValues = {
        baseUrl: input.baseUrl,
        enabled: input.enabled ?? true,
        isActive,
        lastCheckedAt: input.lastCheckedAt,
        lastError: input.lastError,
        lastSyncedAt: input.lastSyncedAt ?? null,
        name: input.name,
        updatedAt: timestamp,
    };

    if (isActive) {
        await clearActiveAgentRuntimeConnection();
    }

    await db
        .insert(agentRuntimeConnectionsTable)
        .values({
            authJson,
            baseUrl: input.baseUrl,
            createdAt: timestamp,
            enabled: input.enabled ?? true,
            id,
            isActive,
            lastCheckedAt: input.lastCheckedAt,
            lastError: input.lastError,
            lastSyncedAt: input.lastSyncedAt ?? null,
            name: input.name,
            updatedAt: timestamp,
        })
        .onConflictDoUpdate({
            target: agentRuntimeConnectionsTable.id,
            set:
                input.auth === undefined
                    ? updateValues
                    : {
                          ...updateValues,
                          authJson,
                      },
        });

    const [record] = await db
        .select()
        .from(agentRuntimeConnectionsTable)
        .where(eq(agentRuntimeConnectionsTable.id, id))
        .limit(1);

    return record ?? null;
}

export async function markAgentRuntimeConnectionSync(input: {
    id: string;
    lastError: string | null;
    lastSyncedAt?: string | null;
}) {
    const timestamp = new Date().toISOString();
    const environmentRecord = getEnvironmentAgentRuntimeConnection();

    if (environmentRecord?.id === input.id) {
        saveEnvironmentAgentRuntimeConnection({
            baseUrl: environmentRecord.baseUrl,
            enabled: environmentRecord.enabled,
            id: environmentRecord.id,
            lastCheckedAt: timestamp,
            lastError: input.lastError,
            lastSyncedAt: input.lastSyncedAt ?? null,
            name: environmentRecord.name,
        });
        return;
    }

    await db
        .update(agentRuntimeConnectionsTable)
        .set({
            lastCheckedAt: timestamp,
            lastError: input.lastError,
            lastSyncedAt: input.lastSyncedAt ?? null,
            updatedAt: timestamp,
        })
        .where(eq(agentRuntimeConnectionsTable.id, input.id));
}

export async function deleteAgentRuntimeConnection(id: string) {
    deleteRuntimeData(id);
    await db.delete(agentRuntimeConnectionsTable).where(eq(agentRuntimeConnectionsTable.id, id));
    await ensureActiveAgentRuntimeConnection();
}

export async function disableAgentRuntimeConnection(id: string) {
    await db
        .update(agentRuntimeConnectionsTable)
        .set({
            enabled: false,
            lastError: null,
            updatedAt: new Date().toISOString(),
        })
        .where(eq(agentRuntimeConnectionsTable.id, id));
}

export async function activateAgentRuntimeConnection(id: string) {
    const connection = await getAgentRuntimeConnection(id);

    if (!connection) {
        return null;
    }

    await clearActiveAgentRuntimeConnection();
    await db
        .update(agentRuntimeConnectionsTable)
        .set({
            isActive: true,
            updatedAt: new Date().toISOString(),
        })
        .where(eq(agentRuntimeConnectionsTable.id, id));

    return await getAgentRuntimeConnection(id);
}

async function clearActiveAgentRuntimeConnection() {
    await db.update(agentRuntimeConnectionsTable).set({ isActive: false });
}

async function ensureActiveAgentRuntimeConnection() {
    const records = await listAgentRuntimeConnectionRecords();

    if (records.some((record) => record.isActive) || records.length === 0) {
        return;
    }

    const [next] = records;
    if (!next) {
        return;
    }

    await activateAgentRuntimeConnection(next.id);
}

const directAgentReferences = [
    { column: 'tavern_agent_id', table: 'activity_items' },
    { column: 'agent_id', table: 'agent_thought_snapshots' },
    { column: 'agent_id', table: 'cron_runs' },
    { column: 'agent_id', table: 'memory_peer_mappings' },
    { column: 'agent_id', table: 'messaging_bindings' },
    { column: 'agent_id', table: 'model_selections' },
    { column: 'agent_id', table: 'session_tool_calls' },
] as const;

const sessionKeyReferences = [
    { column: 'session_key', table: 'session_access_events' },
    { column: 'session_key', table: 'session_artifacts' },
    { column: 'session_key', table: 'session_message_parts' },
    { column: 'session_key', table: 'session_messages' },
    { column: 'session_key', table: 'session_tool_calls' },
    { column: 'target_session_key', table: 'session_access_events' },
] as const;

const sessionLinkReferences = [
    { column: 'child_session_key', table: 'session_deliveries' },
    { column: 'child_session_key', table: 'session_links' },
    { column: 'parent_session_key', table: 'session_deliveries' },
    { column: 'parent_session_key', table: 'session_links' },
] as const;

function hasColumn(table: string, column: string) {
    const row = databaseClient
        .query(`SELECT 1 FROM pragma_table_info('${table}') WHERE name = ? LIMIT 1`)
        .get(column);

    return Boolean(row);
}

function deleteColumnValue(table: string, column: string, value: string) {
    if (!hasColumn(table, column)) {
        return;
    }

    databaseClient.query(`DELETE FROM ${table} WHERE ${column} = ?`).run(value);
}

function listRuntimeAgentIds(runtimeId: string) {
    return (
        databaseClient.query('SELECT id FROM agents WHERE runtime_id = ?').all(runtimeId) as Array<{
            id: string;
        }>
    ).map((record) => record.id);
}

function listRuntimeSessionKeys(runtimeId: string) {
    const records = databaseClient
        .query(`
            SELECT session_key AS sessionKey FROM session_runs WHERE runtime = ?
            UNION
            SELECT session_key AS sessionKey FROM cron_runs WHERE runtime_id = ?
        `)
        .all(runtimeId, runtimeId) as Array<{ sessionKey: string }>;

    return records.map((record) => record.sessionKey);
}

function deleteRuntimeData(runtimeId: string) {
    const agentIds = listRuntimeAgentIds(runtimeId);
    const sessionKeys = listRuntimeSessionKeys(runtimeId);

    databaseClient.exec('BEGIN');

    try {
        for (const sessionKey of sessionKeys) {
            for (const reference of sessionKeyReferences) {
                deleteColumnValue(reference.table, reference.column, sessionKey);
            }
            for (const reference of sessionLinkReferences) {
                deleteColumnValue(reference.table, reference.column, sessionKey);
            }
        }

        for (const agentId of agentIds) {
            for (const reference of directAgentReferences) {
                deleteColumnValue(reference.table, reference.column, agentId);
            }
        }

        deleteColumnValue('agent_profiles', 'runtime_id', runtimeId);
        deleteColumnValue('agents', 'runtime_id', runtimeId);
        deleteColumnValue('cron_jobs', 'runtime_id', runtimeId);
        deleteColumnValue('cron_runs', 'runtime_id', runtimeId);
        deleteColumnValue('openclaw_config_snapshots', 'runtime_id', runtimeId);
        deleteColumnValue('session_runs', 'runtime', runtimeId);
        deleteColumnValue('skills', 'runtime_id', runtimeId);
        deleteColumnValue('sync_state', 'id', formatSkillInventorySyncStateId(runtimeId));
        deleteColumnValue('sync_state', 'id', runtimeId);

        databaseClient.exec('COMMIT');
    } catch (error) {
        databaseClient.exec('ROLLBACK');
        throw error;
    }
}

function inferLatestRuntimeId() {
    const record = databaseClient
        .query(`
            SELECT runtime_id AS runtimeId
            FROM (
                SELECT runtime_id, updated_at FROM agents
                UNION ALL
                SELECT runtime_id, updated_at FROM cron_jobs
                UNION ALL
                SELECT runtime_id, synced_at AS updated_at FROM cron_runs WHERE runtime_id IS NOT NULL
                UNION ALL
                SELECT runtime AS runtime_id, updated_at FROM session_runs WHERE runtime IS NOT NULL
            )
            WHERE runtime_id IS NOT NULL
            GROUP BY runtime_id
            ORDER BY MAX(updated_at) DESC, runtime_id ASC
            LIMIT 1
        `)
        .get() as { runtimeId: string } | null;

    return record?.runtimeId ?? null;
}
