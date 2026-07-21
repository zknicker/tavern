import {
    type AgentRuntimeAgent,
    type AgentRuntimePluginId,
    agentRuntimeAgentListSchema,
    agentRuntimeAgentSchema,
    agentRuntimePluginIdSchema,
} from '@tavern/api';
import { tavernPluginManifests } from '@tavern/api/plugins';
import { getDb } from '../db/connection';
import type { Database } from '../db/sqlite';
import { namedParams } from '../db/sqlite';
import { archiveAgentDmChat, ensureAgentDmChat } from './bootstrap-chats';

interface AgentRow {
    created_at: string;
    enabled_skill_ids_json: string;
    id: string;
    is_admin: 0 | 1;
    last_synced_at: string;
    name: string;
    primary_color: string | null;
    raw_json: string;
    updated_at: string;
    workspace_folder: string;
}

export function listStoredAgents(db: Database = getDb()) {
    const rows = db.prepare('SELECT * FROM agents ORDER BY name ASC, id ASC').all() as AgentRow[];

    return agentRuntimeAgentListSchema.parse({
        agents: rows.map((row) => rowToAgent(row, db)),
    });
}

export function getStoredAgent(agentId: string, db: Database = getDb()) {
    const row = db
        .prepare('SELECT * FROM agents WHERE id = $id LIMIT 1')
        .get(namedParams({ id: agentId })) as AgentRow | null;

    return row ? rowToAgent(row, db) : null;
}

export function upsertStoredAgent(input: {
    agent: AgentRuntimeAgent;
    db?: Database;
    syncedAt?: string;
}) {
    const db = input.db ?? getDb();
    const syncedAt = input.syncedAt ?? new Date().toISOString();
    const existing = getStoredAgent(input.agent.id, db);
    const agent = agentRuntimeAgentSchema.parse({
        ...input.agent,
        bio: input.agent.bio === undefined ? (existing?.bio ?? undefined) : input.agent.bio,
        // null clears the override; only undefined preserves the stored value.
        thinkingDefault:
            input.agent.thinkingDefault === undefined
                ? (existing?.thinkingDefault ?? undefined)
                : input.agent.thinkingDefault,
    });

    writeStoredAgent({
        agent,
        createdAt: existing ? undefined : syncedAt,
        db,
        syncedAt,
    });
    ensureAgentDmChat({ agentId: agent.id, agentName: agent.name, db });

    const saved = getStoredAgent(agent.id, db);
    if (!saved) {
        throw new Error(`Agent "${agent.id}" was not persisted.`);
    }
    return saved;
}

export function deleteStoredAgent(agentId: string, db: Database = getDb()) {
    db.exec('BEGIN IMMEDIATE');
    try {
        db.prepare('DELETE FROM agents WHERE id = $id').run(namedParams({ id: agentId }));
        archiveAgentDmChat({ agentId, db });
        db.exec('COMMIT');
    } catch (error) {
        db.exec('ROLLBACK');
        throw error;
    }
}

export function updateStoredAgent(input: {
    agentId: string;
    autoDispatchEnabled?: boolean;
    webAccessEnabled?: boolean;
    bio?: string | null;
    db?: Database;
    enabledPluginIds?: AgentRuntimePluginId[];
    enabledSkillIds?: string[];
    name?: string;
    taskReviewPolicy?: boolean;
    thinkingDefault?: AgentRuntimeAgent['thinkingDefault'];
}) {
    const db = input.db ?? getDb();
    const existing = getStoredAgent(input.agentId, db);
    if (!existing) {
        return null;
    }

    return upsertStoredAgent({
        agent: {
            ...existing,
            ...(input.autoDispatchEnabled === undefined
                ? {}
                : { autoDispatchEnabled: input.autoDispatchEnabled }),
            ...(input.webAccessEnabled === undefined
                ? {}
                : { webAccessEnabled: input.webAccessEnabled }),
            ...(input.bio === undefined ? {} : { bio: input.bio }),
            ...(input.enabledSkillIds === undefined
                ? {}
                : { enabledSkillIds: input.enabledSkillIds }),
            ...(input.enabledPluginIds === undefined
                ? {}
                : { enabledPluginIds: input.enabledPluginIds }),
            ...(input.name === undefined ? {} : { name: input.name }),
            ...(input.taskReviewPolicy === undefined
                ? {}
                : { taskReviewPolicy: input.taskReviewPolicy }),
            ...(input.thinkingDefault === undefined
                ? {}
                : { thinkingDefault: input.thinkingDefault }),
        },
        db,
    });
}

export function replaceStoredAgents(input: {
    agents: AgentRuntimeAgent[];
    syncedAt?: string;
    db?: Database;
}) {
    const db = input.db ?? getDb();
    const syncedAt = input.syncedAt ?? new Date().toISOString();
    const existing = listStoredAgents(db).agents;
    const existingJsonById = new Map(existing.map((agent) => [agent.id, stableAgentJson(agent)]));
    const nextJsonById = new Map(input.agents.map((agent) => [agent.id, stableAgentJson(agent)]));
    const changedAgentIds = new Set<string>();

    for (const agent of input.agents) {
        if (existingJsonById.get(agent.id) !== nextJsonById.get(agent.id)) {
            changedAgentIds.add(agent.id);
        }
    }

    for (const agent of existing) {
        if (!nextJsonById.has(agent.id)) {
            changedAgentIds.add(agent.id);
        }
    }

    db.exec('BEGIN IMMEDIATE');
    try {
        for (const agent of input.agents) {
            writeStoredAgent({ agent, createdAt: syncedAt, db, syncedAt });
        }

        const nextIds = input.agents.map((agent) => agent.id);
        if (nextIds.length === 0) {
            db.prepare('DELETE FROM agents').run();
        } else {
            const placeholders = nextIds.map(() => '?').join(', ');
            db.prepare(`DELETE FROM agents WHERE id NOT IN (${placeholders})`).run(...nextIds);
        }
        db.exec('COMMIT');
    } catch (error) {
        db.exec('ROLLBACK');
        throw error;
    }

    for (const agent of input.agents) {
        ensureAgentDmChat({ agentId: agent.id, agentName: agent.name, db });
    }

    return {
        changedAgentIds: [...changedAgentIds].sort(),
        synced: input.agents.length,
    };
}

function rowToAgent(row: AgentRow, db: Database): AgentRuntimeAgent {
    const raw = parseRawAgent(row.raw_json);

    return agentRuntimeAgentSchema.parse({
        autoDispatchEnabled: raw?.autoDispatchEnabled ?? false,
        webAccessEnabled: raw?.webAccessEnabled ?? false,
        ...(raw?.bio == null ? {} : { bio: raw.bio }),
        enabledPluginIds: listAgentPluginGrantIds(row.id, db),
        enabledSkillIds: listAssignedSkillIds(row.id, row.enabled_skill_ids_json, db),
        id: row.id,
        isAdmin: row.is_admin === 1,
        name: row.name,
        primaryColor: row.primary_color,
        taskReviewPolicy: raw?.taskReviewPolicy ?? false,
        ...(raw?.thinkingDefault === undefined ? {} : { thinkingDefault: raw.thinkingDefault }),
        workspaceFolder: row.workspace_folder,
    });
}

export function listAgentPluginGrants(agentId: string, db: Database = getDb()) {
    return db
        .prepare(
            `SELECT plugin_id, enabled, updated_at
             FROM agent_plugin_grants
             WHERE agent_id = $agentId
             ORDER BY plugin_id ASC`
        )
        .all(namedParams({ agentId })) as Array<{
        enabled: 0 | 1;
        plugin_id: string;
        updated_at: string;
    }>;
}

export function setAgentPluginGrant(input: {
    agentId: string;
    db?: Database;
    enabled: boolean;
    pluginId: AgentRuntimePluginId;
}) {
    const db = input.db ?? getDb();
    const now = new Date().toISOString();
    const pluginId = agentRuntimePluginIdSchema.parse(input.pluginId);
    const existingAgent = getStoredAgent(input.agentId, db);
    if (!existingAgent) {
        throw new Error(`Agent "${input.agentId}" does not exist.`);
    }
    if (input.enabled && !isPluginGloballyEnabled(pluginId, db)) {
        throw new Error(
            `Enable ${pluginDisplayName(pluginId)} in Settings -> Plugins before granting it to an agent.`
        );
    }

    db.prepare(
        `INSERT OR IGNORE INTO runtime_plugins (id, enabled, config_json, created_at, updated_at)
         VALUES ($pluginId, 0, '{}', $now, $now)`
    ).run(namedParams({ now, pluginId }));

    db.prepare(
        `INSERT INTO agent_plugin_grants
         (agent_id, plugin_id, enabled, created_at, updated_at)
         VALUES ($agentId, $pluginId, $enabled, $now, $now)
         ON CONFLICT(agent_id, plugin_id) DO UPDATE SET
           enabled = excluded.enabled,
           updated_at = excluded.updated_at`
    ).run(
        namedParams({
            agentId: input.agentId,
            enabled: input.enabled ? 1 : 0,
            now,
            pluginId,
        })
    );

    const agent = getStoredAgent(input.agentId, db);
    return agent ?? existingAgent;
}

function parseEnabledSkillIds(value: string) {
    try {
        const parsed = JSON.parse(value) as unknown;
        if (Array.isArray(parsed) && parsed.every((entry) => typeof entry === 'string')) {
            return parsed;
        }
    } catch {
        return [];
    }

    return [];
}

function listAssignedSkillIds(agentId: string, fallbackJson: string, db: Database = getDb()) {
    const rows = db
        .prepare(
            `SELECT skill_id
             FROM agent_skill_assignments
             WHERE agent_id = $agentId AND enabled = 1
             ORDER BY created_at ASC, skill_id ASC`
        )
        .all(namedParams({ agentId })) as Array<{ skill_id: string }>;

    return rows.length > 0 ? rows.map((row) => row.skill_id) : parseEnabledSkillIds(fallbackJson);
}

function listAgentPluginGrantIds(agentId: string, db: Database = getDb()) {
    const rows = db
        .prepare(
            `SELECT plugin_id
             FROM agent_plugin_grants
             WHERE agent_id = $agentId AND enabled = 1
             ORDER BY created_at ASC, plugin_id ASC`
        )
        .all(namedParams({ agentId })) as Array<{ plugin_id: string }>;

    return rows.map((row) => agentRuntimePluginIdSchema.parse(row.plugin_id));
}

function stableAgentJson(agent: AgentRuntimeAgent) {
    return JSON.stringify({
        autoDispatchEnabled: agent.autoDispatchEnabled ?? false,
        webAccessEnabled: agent.webAccessEnabled ?? false,
        ...(agent.bio == null ? {} : { bio: agent.bio }),
        enabledPluginIds: agent.enabledPluginIds ?? [],
        enabledSkillIds: agent.enabledSkillIds,
        id: agent.id,
        isAdmin: agent.isAdmin,
        name: agent.name,
        primaryColor: agent.primaryColor,
        taskReviewPolicy: agent.taskReviewPolicy ?? false,
        ...(agent.thinkingDefault === undefined ? {} : { thinkingDefault: agent.thinkingDefault }),
        workspaceFolder: agent.workspaceFolder,
    });
}

function parseRawAgent(value: string) {
    try {
        const parsed = JSON.parse(value) as unknown;
        const result = agentRuntimeAgentSchema.safeParse(parsed);
        return result.success ? result.data : null;
    } catch {
        return null;
    }
}

function writeStoredAgent(input: {
    agent: AgentRuntimeAgent;
    createdAt?: string;
    db: Database;
    syncedAt: string;
}) {
    const enabledSkillIds = [...new Set(input.agent.enabledSkillIds)];
    const enabledPluginIds = [...new Set(input.agent.enabledPluginIds ?? [])];

    input.db
        .prepare(
            `INSERT INTO agents (
                id,
                name,
                primary_color,
                workspace_folder,
                enabled_skill_ids_json,
                is_admin,
                raw_json,
                last_synced_at,
                created_at,
                updated_at
            )
            VALUES (
                $id,
                $name,
                $primaryColor,
                $workspaceFolder,
                $enabledSkillIdsJson,
                $isAdmin,
                $rawJson,
                $lastSyncedAt,
                $createdAt,
                $updatedAt
            )
            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                primary_color = excluded.primary_color,
                workspace_folder = excluded.workspace_folder,
                enabled_skill_ids_json = excluded.enabled_skill_ids_json,
                is_admin = excluded.is_admin,
                raw_json = excluded.raw_json,
                last_synced_at = excluded.last_synced_at,
                updated_at = excluded.updated_at`
        )
        .run(
            namedParams({
                createdAt: input.createdAt ?? input.syncedAt,
                enabledSkillIdsJson: JSON.stringify(enabledSkillIds),
                id: input.agent.id,
                isAdmin: input.agent.isAdmin ? 1 : 0,
                lastSyncedAt: input.syncedAt,
                name: input.agent.name,
                primaryColor: input.agent.primaryColor,
                rawJson: stableAgentJson(input.agent),
                updatedAt: input.syncedAt,
                workspaceFolder: input.agent.workspaceFolder,
            })
        );

    replaceAgentSkillAssignments({
        agentId: input.agent.id,
        db: input.db,
        skillIds: enabledSkillIds,
        timestamp: input.syncedAt,
    });
    replaceAgentPluginGrants({
        agentId: input.agent.id,
        db: input.db,
        pluginIds: enabledPluginIds,
        timestamp: input.syncedAt,
    });
}

function replaceAgentSkillAssignments(input: {
    agentId: string;
    db: Database;
    skillIds: string[];
    timestamp: string;
}) {
    input.db
        .prepare('DELETE FROM agent_skill_assignments WHERE agent_id = $agentId')
        .run(namedParams({ agentId: input.agentId }));

    const insert = input.db.prepare(
        `INSERT INTO agent_skill_assignments
         (agent_id, skill_id, enabled, created_at, updated_at)
         VALUES ($agentId, $skillId, 1, $timestamp, $timestamp)`
    );

    for (const skillId of input.skillIds) {
        insert.run(
            namedParams({
                agentId: input.agentId,
                skillId,
                timestamp: input.timestamp,
            })
        );
    }
}

function replaceAgentPluginGrants(input: {
    agentId: string;
    db: Database;
    pluginIds: AgentRuntimePluginId[];
    timestamp: string;
}) {
    input.db
        .prepare('DELETE FROM agent_plugin_grants WHERE agent_id = $agentId')
        .run(namedParams({ agentId: input.agentId }));

    const insertPlugin = input.db.prepare(
        `INSERT OR IGNORE INTO runtime_plugins (id, enabled, config_json, created_at, updated_at)
         VALUES ($pluginId, 0, '{}', $timestamp, $timestamp)`
    );
    const insertGrant = input.db.prepare(
        `INSERT INTO agent_plugin_grants
         (agent_id, plugin_id, enabled, created_at, updated_at)
         VALUES ($agentId, $pluginId, 1, $timestamp, $timestamp)`
    );

    for (const pluginId of input.pluginIds) {
        insertPlugin.run(namedParams({ pluginId, timestamp: input.timestamp }));
        insertGrant.run(
            namedParams({
                agentId: input.agentId,
                pluginId,
                timestamp: input.timestamp,
            })
        );
    }
}

function isPluginGloballyEnabled(pluginId: AgentRuntimePluginId, db: Database) {
    const row = db
        .prepare('SELECT enabled FROM runtime_plugins WHERE id = $pluginId LIMIT 1')
        .get(namedParams({ pluginId })) as { enabled: 0 | 1 } | null;
    return Boolean(row?.enabled);
}

function pluginDisplayName(pluginId: AgentRuntimePluginId) {
    return (
        tavernPluginManifests.find((manifest) => manifest.id === pluginId)?.displayName ?? pluginId
    );
}
