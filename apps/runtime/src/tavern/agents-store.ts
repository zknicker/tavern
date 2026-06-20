import { type AgentRuntimeAgent, agentRuntimeAgentListSchema } from '@tavern/api';
import { getDb } from '../db/connection';
import type { Database } from '../db/sqlite';
import { namedParams } from '../db/sqlite';

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
        agents: rows.map(rowToAgent),
    });
}

export function getStoredAgent(agentId: string, db: Database = getDb()) {
    const row = db
        .prepare('SELECT * FROM agents WHERE id = $id LIMIT 1')
        .get(namedParams({ id: agentId })) as AgentRow | null;

    return row ? rowToAgent(row) : null;
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
            db.prepare(
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
            ).run(
                namedParams({
                    createdAt: syncedAt,
                    enabledSkillIdsJson: JSON.stringify(agent.enabledSkillIds),
                    id: agent.id,
                    isAdmin: agent.isAdmin ? 1 : 0,
                    lastSyncedAt: syncedAt,
                    name: agent.name,
                    primaryColor: agent.primaryColor,
                    rawJson: stableAgentJson(agent),
                    updatedAt: syncedAt,
                    workspaceFolder: agent.workspaceFolder,
                })
            );
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

    return {
        changedAgentIds: [...changedAgentIds].sort(),
        synced: input.agents.length,
    };
}

function rowToAgent(row: AgentRow): AgentRuntimeAgent {
    return {
        enabledSkillIds: parseEnabledSkillIds(row.enabled_skill_ids_json),
        id: row.id,
        isAdmin: row.is_admin === 1,
        name: row.name,
        primaryColor: row.primary_color,
        workspaceFolder: row.workspace_folder,
    };
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

function stableAgentJson(agent: AgentRuntimeAgent) {
    return JSON.stringify({
        enabledSkillIds: agent.enabledSkillIds,
        id: agent.id,
        isAdmin: agent.isAdmin,
        name: agent.name,
        primaryColor: agent.primaryColor,
        workspaceFolder: agent.workspaceFolder,
    });
}
