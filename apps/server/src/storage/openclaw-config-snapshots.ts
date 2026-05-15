import type { AgentRuntimeOpenClawConfigSnapshot } from '@tavern/agent-runtime-protocol';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { openClawConfigSnapshotsTable } from '../db/schema.ts';

export type OpenClawConfigSnapshotRecord = typeof openClawConfigSnapshotsTable.$inferSelect;

export async function getOpenClawConfigSnapshot(runtimeId: string) {
    const [record] = await db
        .select()
        .from(openClawConfigSnapshotsTable)
        .where(eq(openClawConfigSnapshotsTable.runtimeId, runtimeId))
        .limit(1);

    return record ?? null;
}

export async function saveOpenClawConfigSnapshot(input: {
    runtimeId: string;
    snapshot: AgentRuntimeOpenClawConfigSnapshot;
    syncedAt?: string;
}) {
    const timestamp = input.syncedAt ?? new Date().toISOString();

    await db
        .insert(openClawConfigSnapshotsTable)
        .values({
            configJson: JSON.stringify(input.snapshot.config),
            hash: input.snapshot.hash,
            issuesJson: JSON.stringify(input.snapshot.issues),
            lastError: null,
            lastSyncedAt: timestamp,
            raw: input.snapshot.raw ?? JSON.stringify(input.snapshot.config),
            runtimeId: input.runtimeId,
            updatedAt: timestamp,
            valid: input.snapshot.valid === null ? 'unknown' : String(input.snapshot.valid),
        })
        .onConflictDoUpdate({
            target: openClawConfigSnapshotsTable.runtimeId,
            set: {
                configJson: JSON.stringify(input.snapshot.config),
                hash: input.snapshot.hash,
                issuesJson: JSON.stringify(input.snapshot.issues),
                lastError: null,
                lastSyncedAt: timestamp,
                raw: input.snapshot.raw ?? JSON.stringify(input.snapshot.config),
                updatedAt: timestamp,
                valid: input.snapshot.valid === null ? 'unknown' : String(input.snapshot.valid),
            },
        });

    return await getOpenClawConfigSnapshot(input.runtimeId);
}

export async function markOpenClawConfigSnapshotError(input: { error: string; runtimeId: string }) {
    const timestamp = new Date().toISOString();

    await db
        .insert(openClawConfigSnapshotsTable)
        .values({
            configJson: '{}',
            hash: 'unknown',
            issuesJson: '[]',
            lastError: input.error,
            lastSyncedAt: timestamp,
            raw: '{}',
            runtimeId: input.runtimeId,
            updatedAt: timestamp,
            valid: 'unknown',
        })
        .onConflictDoUpdate({
            target: openClawConfigSnapshotsTable.runtimeId,
            set: {
                lastError: input.error,
                updatedAt: timestamp,
            },
        });
}

export async function deleteOpenClawConfigSnapshotsForRuntime(runtimeId: string) {
    await db
        .delete(openClawConfigSnapshotsTable)
        .where(eq(openClawConfigSnapshotsTable.runtimeId, runtimeId));
}
