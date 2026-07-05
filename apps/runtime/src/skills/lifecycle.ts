import fs from 'node:fs/promises';
import path from 'node:path';
import { agentEngineSkillsDir } from '../agent-engine/skill-library.ts';
import { getDb } from '../db/connection.ts';
import type { Database } from '../db/sqlite.ts';
import { namedParams } from '../db/sqlite.ts';
import type { SkillSource } from './store.ts';

export type SkillLifecycleState = 'active' | 'archived' | 'stale';

export interface SkillLifecycleTransition {
    lastUsedAt: string;
    nextState: SkillLifecycleState;
    previousState: SkillLifecycleState;
    skillId: string;
}

interface SkillLifecycleRow {
    created_at: string;
    last_used_at: string | null;
    skill_id: string;
    source: SkillSource;
    state: SkillLifecycleState;
}

const staleAfterMs = 30 * 24 * 60 * 60 * 1000;
const archiveAfterMs = 90 * 24 * 60 * 60 * 1000;

export async function applySkillLifecycleTransitions(
    input: { db?: Database; now?: Date; skillsDir?: string } = {}
) {
    const db = input.db ?? getDb();
    const now = input.now ?? new Date();
    const rows = db
        .prepare(
            `SELECT
                source.skill_id,
                source.source,
                source.state,
                source.created_at,
                MAX(usage.occurred_at) AS last_used_at
             FROM skill_sources source
             LEFT JOIN skill_usage usage ON usage.skill_id = source.skill_id
             WHERE source.source = 'agent' AND source.state != 'archived'
             GROUP BY source.skill_id`
        )
        .all() as SkillLifecycleRow[];

    const transitions: SkillLifecycleTransition[] = [];
    for (const row of rows) {
        const lastUsedAt = row.last_used_at ?? row.created_at;
        const nextState = lifecycleStateForLastUse(lastUsedAt, now);
        if (nextState === row.state) {
            continue;
        }
        if (nextState === 'archived') {
            await archiveAgentSkill({
                db,
                now,
                skillId: row.skill_id,
                skillsDir: input.skillsDir,
            });
        } else {
            setSkillLifecycleState({
                db,
                now,
                skillId: row.skill_id,
                state: nextState,
            });
        }
        transitions.push({
            lastUsedAt,
            nextState,
            previousState: row.state,
            skillId: row.skill_id,
        });
    }

    return transitions;
}

export async function archiveAgentSkill(input: {
    db?: Database;
    now?: Date;
    skillId: string;
    skillsDir?: string;
}) {
    const db = input.db ?? getDb();
    const source = db
        .prepare('SELECT source FROM skill_sources WHERE skill_id = $skillId')
        .get(namedParams({ skillId: input.skillId })) as { source: SkillSource } | null;
    if (source?.source !== 'agent') {
        throw new Error(
            `Skill "${input.skillId}" cannot be archived because its source is ${source?.source ?? 'external'}.`
        );
    }

    const now = input.now ?? new Date();
    await moveSkillToArchive({
        skillId: input.skillId,
        skillsDir: input.skillsDir ?? agentEngineSkillsDir,
    });
    setSkillLifecycleState({
        archivedAt: now,
        db,
        now,
        skillId: input.skillId,
        state: 'archived',
    });
    disableSkillAssignments({ db, now, skillId: input.skillId });

    return {
        archivedAt: now.toISOString(),
        skillId: input.skillId,
    };
}

function lifecycleStateForLastUse(lastUsedAt: string, now: Date): SkillLifecycleState {
    const unusedMs = now.getTime() - new Date(lastUsedAt).getTime();
    if (unusedMs >= archiveAfterMs) {
        return 'archived';
    }
    if (unusedMs >= staleAfterMs) {
        return 'stale';
    }
    return 'active';
}

async function moveSkillToArchive(input: { skillId: string; skillsDir: string }) {
    const sourceDir = path.join(input.skillsDir, input.skillId);
    const archiveDir = path.join(input.skillsDir, '.archive');
    const destinationDir = path.join(archiveDir, input.skillId);
    const sourceStat = await fs.stat(sourceDir).catch((error) => {
        if (isNotFoundError(error)) {
            return null;
        }
        throw error;
    });
    if (sourceStat === null) {
        await fs.mkdir(archiveDir, { recursive: true });
        return;
    }
    if (!sourceStat.isDirectory()) {
        throw new Error(`Skill package is not a directory: ${input.skillId}`);
    }

    await fs.mkdir(archiveDir, { recursive: true });
    await fs.rm(destinationDir, { force: true, recursive: true });
    await fs.rename(sourceDir, destinationDir);
}

function setSkillLifecycleState(input: {
    archivedAt?: Date;
    db: Database;
    now: Date;
    skillId: string;
    state: SkillLifecycleState;
}) {
    input.db
        .prepare(
            `UPDATE skill_sources
         SET state = $state,
             archived_at = $archivedAt,
             updated_at = $now
         WHERE skill_id = $skillId`
        )
        .run(
            namedParams({
                archivedAt: input.archivedAt?.toISOString() ?? null,
                now: input.now.toISOString(),
                skillId: input.skillId,
                state: input.state,
            })
        );
}

function disableSkillAssignments(input: { db: Database; now: Date; skillId: string }) {
    input.db
        .prepare(
            `UPDATE agent_skill_assignments
             SET enabled = 0,
                 updated_at = $now
             WHERE skill_id = $skillId`
        )
        .run(namedParams({ now: input.now.toISOString(), skillId: input.skillId }));
}

function isNotFoundError(error: unknown) {
    return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}
