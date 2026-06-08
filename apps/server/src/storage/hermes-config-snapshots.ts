import type { AgentRuntimeHermesConfigSnapshot } from '@tavern/api';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { hermesConfigSnapshotsTable } from '../db/schema.ts';

export type HermesConfigSnapshotRecord = typeof hermesConfigSnapshotsTable.$inferSelect;

export async function getHermesConfigSnapshot(runtimeId: string) {
    const [record] = await db
        .select()
        .from(hermesConfigSnapshotsTable)
        .where(eq(hermesConfigSnapshotsTable.runtimeId, runtimeId))
        .limit(1);

    return record ?? null;
}

export async function saveHermesConfigSnapshot(input: {
    runtimeId: string;
    snapshot: AgentRuntimeHermesConfigSnapshot;
    syncedAt?: string;
}) {
    const timestamp = input.syncedAt ?? new Date().toISOString();

    await db
        .insert(hermesConfigSnapshotsTable)
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
            target: hermesConfigSnapshotsTable.runtimeId,
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

    return await getHermesConfigSnapshot(input.runtimeId);
}

export async function markHermesConfigSnapshotError(input: { error: string; runtimeId: string }) {
    const timestamp = new Date().toISOString();

    await db
        .insert(hermesConfigSnapshotsTable)
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
            target: hermesConfigSnapshotsTable.runtimeId,
            set: {
                lastError: input.error,
                updatedAt: timestamp,
            },
        });
}

export async function deleteHermesConfigSnapshotsForRuntime(runtimeId: string) {
    await db
        .delete(hermesConfigSnapshotsTable)
        .where(eq(hermesConfigSnapshotsTable.runtimeId, runtimeId));
}
