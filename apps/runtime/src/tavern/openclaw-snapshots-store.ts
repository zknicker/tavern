import {
    type AgentRuntimeChat,
    type AgentRuntimeModels,
    type AgentRuntimeSkill,
    type AgentRuntimeSkillSummary,
    agentRuntimeChatListSchema,
    agentRuntimeModelsSchema,
    agentRuntimeSkillListSchema,
    agentRuntimeSkillSchema,
} from '@tavern/api';
import { getDb } from '../db/connection';
import type { Database } from '../db/sqlite';
import { namedParams } from '../db/sqlite';

interface RawJsonRow {
    raw_json: string;
}

interface SnapshotStatus {
    hasSnapshot: boolean;
    lastSyncedAt: null | string;
}

interface SkillRow {
    detail_json: string | null;
    id: string;
    summary_json: string;
}

const emptyModels: AgentRuntimeModels = {
    agents: [],
    configuredModels: [],
    defaults: {
        fallbackModels: [],
        primaryModel: null,
    },
    defaultsThinkingLevel: null,
    subAgentDefaultModel: null,
    subAgentThinkingLevel: null,
    updatedAt: null,
};

export function listStoredOpenClawChats(db: Database = getDb()) {
    const rows = db
        .prepare('SELECT raw_json FROM openclaw_chats ORDER BY id ASC')
        .all() as RawJsonRow[];

    return agentRuntimeChatListSchema.parse({
        chats: rows.map((row) => JSON.parse(row.raw_json)),
    });
}

export function replaceStoredOpenClawChats(input: {
    chats: AgentRuntimeChat[];
    db?: Database;
    pruneMissing?: boolean;
    syncedAt?: string;
}) {
    const db = input.db ?? getDb();
    const syncedAt = input.syncedAt ?? new Date().toISOString();

    db.exec('BEGIN IMMEDIATE');
    try {
        for (const chat of input.chats) {
            db.prepare(
                `INSERT INTO openclaw_chats (
                    id,
                    raw_json,
                    last_synced_at,
                    created_at,
                    updated_at
                )
                VALUES (
                    $id,
                    $rawJson,
                    $lastSyncedAt,
                    $createdAt,
                    $updatedAt
                )
                ON CONFLICT(id) DO UPDATE SET
                    raw_json = excluded.raw_json,
                    last_synced_at = excluded.last_synced_at,
                    updated_at = excluded.updated_at`
            ).run(
                namedParams({
                    createdAt: syncedAt,
                    id: chat.id,
                    lastSyncedAt: syncedAt,
                    rawJson: stableJson(chat),
                    updatedAt: syncedAt,
                })
            );
        }

        if (input.pruneMissing ?? true) {
            deleteMissingRows(
                db,
                'openclaw_chats',
                input.chats.map((chat) => chat.id)
            );
        }
        db.exec('COMMIT');
    } catch (error) {
        db.exec('ROLLBACK');
        throw error;
    }

    return { synced: input.chats.length };
}

export function getStoredOpenClawModels(db: Database = getDb()) {
    const row = db
        .prepare("SELECT raw_json FROM openclaw_models_snapshot WHERE id = 'default' LIMIT 1")
        .get() as RawJsonRow | null;

    return agentRuntimeModelsSchema.parse(row ? JSON.parse(row.raw_json) : emptyModels);
}

export function getStoredOpenClawModelsSnapshotStatus(db: Database = getDb()): SnapshotStatus {
    const row = db
        .prepare("SELECT last_synced_at FROM openclaw_models_snapshot WHERE id = 'default' LIMIT 1")
        .get() as { last_synced_at: string } | null;

    return {
        hasSnapshot: Boolean(row),
        lastSyncedAt: row?.last_synced_at ?? null,
    };
}

export function replaceStoredOpenClawModels(input: {
    db?: Database;
    models: AgentRuntimeModels;
    syncedAt?: string;
}) {
    const db = input.db ?? getDb();
    const syncedAt = input.syncedAt ?? new Date().toISOString();
    const existing = getStoredOpenClawModels(db);
    const nextJson = stableJson(input.models);
    const changed = stableJson(existing) !== nextJson;

    db.prepare(
        `INSERT INTO openclaw_models_snapshot (
            id,
            raw_json,
            last_synced_at,
            created_at,
            updated_at
        )
        VALUES (
            'default',
            $rawJson,
            $lastSyncedAt,
            $createdAt,
            $updatedAt
        )
        ON CONFLICT(id) DO UPDATE SET
            raw_json = excluded.raw_json,
            last_synced_at = excluded.last_synced_at,
            updated_at = excluded.updated_at`
    ).run(
        namedParams({
            createdAt: syncedAt,
            lastSyncedAt: syncedAt,
            rawJson: nextJson,
            updatedAt: syncedAt,
        })
    );

    return { changed, synced: 1 };
}

export function listStoredOpenClawSkills(db: Database = getDb()) {
    const rows = db
        .prepare('SELECT summary_json FROM openclaw_skills ORDER BY id ASC')
        .all() as Array<{ summary_json: string }>;

    return agentRuntimeSkillListSchema.parse({
        skills: rows.map((row) => JSON.parse(row.summary_json)),
    });
}

export function getStoredOpenClawSkillsSnapshotStatus(db: Database = getDb()): SnapshotStatus {
    const row = db
        .prepare(
            `SELECT COUNT(*) AS count, MAX(last_synced_at) AS last_synced_at
             FROM openclaw_skills`
        )
        .get() as { count: number; last_synced_at: null | string };

    return {
        hasSnapshot: row.count > 0,
        lastSyncedAt: row.last_synced_at,
    };
}

export function getStoredOpenClawSkill(skillId: string, db: Database = getDb()) {
    const row = db
        .prepare('SELECT * FROM openclaw_skills WHERE id = $id LIMIT 1')
        .get(namedParams({ id: skillId })) as SkillRow | null;

    if (!row) {
        return null;
    }

    if (row.detail_json) {
        return agentRuntimeSkillSchema.parse(JSON.parse(row.detail_json));
    }

    return agentRuntimeSkillSchema.parse({
        ...JSON.parse(row.summary_json),
        contentMarkdown: '',
        files: [],
        installSource: null,
    });
}

export function replaceStoredOpenClawSkills(input: {
    db?: Database;
    skills: AgentRuntimeSkillSummary[];
    skillDetails?: AgentRuntimeSkill[];
    syncedAt?: string;
}) {
    const db = input.db ?? getDb();
    const syncedAt = input.syncedAt ?? new Date().toISOString();
    const detailsById = new Map((input.skillDetails ?? []).map((skill) => [skill.id, skill]));
    const existing = listStoredOpenClawSkills(db).skills;
    const existingJsonById = new Map(existing.map((skill) => [skill.id, stableJson(skill)]));
    const nextJsonById = new Map(input.skills.map((skill) => [skill.id, stableJson(skill)]));
    const changedSkillIds = new Set<string>();

    for (const skill of input.skills) {
        if (existingJsonById.get(skill.id) !== nextJsonById.get(skill.id)) {
            changedSkillIds.add(skill.id);
        }
    }

    for (const skill of existing) {
        if (!nextJsonById.has(skill.id)) {
            changedSkillIds.add(skill.id);
        }
    }

    db.exec('BEGIN IMMEDIATE');
    try {
        for (const skill of input.skills) {
            const detail = detailsById.get(skill.id);
            db.prepare(
                `INSERT INTO openclaw_skills (
                    id,
                    summary_json,
                    detail_json,
                    last_synced_at,
                    detail_synced_at,
                    created_at,
                    updated_at
                )
                VALUES (
                    $id,
                    $summaryJson,
                    $detailJson,
                    $lastSyncedAt,
                    $detailSyncedAt,
                    $createdAt,
                    $updatedAt
                )
                ON CONFLICT(id) DO UPDATE SET
                    summary_json = excluded.summary_json,
                    detail_json = COALESCE(excluded.detail_json, openclaw_skills.detail_json),
                    last_synced_at = excluded.last_synced_at,
                    detail_synced_at = COALESCE(
                        excluded.detail_synced_at,
                        openclaw_skills.detail_synced_at
                    ),
                    updated_at = excluded.updated_at`
            ).run(
                namedParams({
                    createdAt: syncedAt,
                    detailJson: detail ? stableJson(detail) : null,
                    detailSyncedAt: detail ? syncedAt : null,
                    id: skill.id,
                    lastSyncedAt: syncedAt,
                    summaryJson: stableJson(skill),
                    updatedAt: syncedAt,
                })
            );
        }

        deleteMissingRows(
            db,
            'openclaw_skills',
            input.skills.map((skill) => skill.id)
        );
        db.exec('COMMIT');
    } catch (error) {
        db.exec('ROLLBACK');
        throw error;
    }

    return {
        changedSkillIds: [...changedSkillIds].sort(),
        synced: input.skills.length,
    };
}

function deleteMissingRows(
    db: Database,
    tableName: 'openclaw_chats' | 'openclaw_skills',
    ids: string[]
) {
    if (ids.length === 0) {
        db.prepare(`DELETE FROM ${tableName}`).run();
        return;
    }

    const placeholders = ids.map(() => '?').join(', ');
    db.prepare(`DELETE FROM ${tableName} WHERE id NOT IN (${placeholders})`).run(...ids);
}

function stableJson(value: unknown) {
    return JSON.stringify(value);
}
