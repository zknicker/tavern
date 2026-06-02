import type { AgentRuntimeSkillSummary } from '@tavern/api';
import { agentRuntimeSkillSummarySchema } from '@tavern/api';
import { and, eq, notInArray } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { type SkillRecord, skillsTable } from '../db/schema.ts';
import { findSyncState, saveSyncState } from './sync-state.ts';

export function formatSkillInventorySyncStateId(runtimeId: string) {
    return `runtime:${runtimeId}:inventory`;
}

function sortSkills(skills: AgentRuntimeSkillSummary[]) {
    return [...skills].sort((left, right) => left.id.localeCompare(right.id));
}

export function parseSkillRecord(record: SkillRecord) {
    return agentRuntimeSkillSummarySchema.parse(JSON.parse(record.summaryJson));
}

export async function listSkillRecordsForRuntime(runtimeId: string) {
    const records = await db.select().from(skillsTable).where(eq(skillsTable.runtimeId, runtimeId));

    return sortSkills(records.map((record) => parseSkillRecord(record)));
}

export async function getSkillInventorySyncState(runtimeId: string) {
    return await findSyncState({
        id: formatSkillInventorySyncStateId(runtimeId),
        kind: 'skill',
    });
}

export async function saveSkillRecordsForRuntime(input: {
    runtimeId: string;
    skills: AgentRuntimeSkillSummary[];
    syncedAt?: string;
}) {
    const existing = await listSkillRecordsForRuntime(input.runtimeId);
    const timestamp = new Date().toISOString();
    const syncedAt = input.syncedAt ?? timestamp;
    const skills = sortSkills(
        input.skills.map((skill) => agentRuntimeSkillSummarySchema.parse(skill))
    );
    const previousJson = JSON.stringify(existing);
    const nextJson = JSON.stringify(skills);

    if (skills.length === 0) {
        await db.delete(skillsTable).where(eq(skillsTable.runtimeId, input.runtimeId));
    } else {
        const skillIds = skills.map((skill) => skill.id);

        await db
            .delete(skillsTable)
            .where(
                and(
                    eq(skillsTable.runtimeId, input.runtimeId),
                    notInArray(skillsTable.id, skillIds)
                )
            );

        for (const skill of skills) {
            await db
                .insert(skillsTable)
                .values({
                    id: skill.id,
                    lastSyncedAt: syncedAt,
                    runtimeId: input.runtimeId,
                    summaryJson: JSON.stringify(skill),
                    updatedAt: timestamp,
                })
                .onConflictDoUpdate({
                    target: [skillsTable.runtimeId, skillsTable.id],
                    set: {
                        lastSyncedAt: syncedAt,
                        summaryJson: JSON.stringify(skill),
                        updatedAt: timestamp,
                    },
                });
        }
    }

    await saveSyncState({
        agentRuntimeHash: null,
        agentRuntimeJson: null,
        hash: null,
        id: formatSkillInventorySyncStateId(input.runtimeId),
        json: null,
        kind: 'skill',
        lastAttemptedAt: syncedAt,
        lastError: null,
        lastSuccessfulAt: syncedAt,
        status: 'inSync',
        updatedAt: timestamp,
    });

    return {
        changed: previousJson !== nextJson,
        skills,
    };
}

export async function markSkillInventoryRefreshError(input: { error: string; runtimeId: string }) {
    const existing = await getSkillInventorySyncState(input.runtimeId);
    const timestamp = new Date().toISOString();

    await saveSyncState({
        agentRuntimeHash: null,
        agentRuntimeJson: null,
        hash: existing?.hash ?? null,
        id: formatSkillInventorySyncStateId(input.runtimeId),
        json: existing?.json ?? null,
        kind: 'skill',
        lastAttemptedAt: timestamp,
        lastError: input.error,
        lastSuccessfulAt: existing?.lastSuccessfulAt ?? null,
        status: 'error',
        updatedAt: timestamp,
    });
}
