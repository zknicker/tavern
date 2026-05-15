import { and, eq, notInArray } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { syncStateTable } from '../db/schema.ts';
import { type SyncPrimitiveState, syncPrimitiveStateSchema } from '../sync/contracts.ts';

export async function listSyncStatesByKind(kind: SyncPrimitiveState['kind']) {
    const records = await db.select().from(syncStateTable).where(eq(syncStateTable.kind, kind));

    return records.map((record) => syncPrimitiveStateSchema.parse(record));
}

export async function saveSyncState(input: SyncPrimitiveState) {
    await db
        .insert(syncStateTable)
        .values(input)
        .onConflictDoUpdate({
            target: [syncStateTable.kind, syncStateTable.id],
            set: input,
        });
}

export async function findSyncState(input: { id: string; kind: SyncPrimitiveState['kind'] }) {
    const [record] = await db
        .select()
        .from(syncStateTable)
        .where(and(eq(syncStateTable.kind, input.kind), eq(syncStateTable.id, input.id)))
        .limit(1);

    return record ? syncPrimitiveStateSchema.parse(record) : null;
}

export async function deleteSyncState(input: { id: string; kind: SyncPrimitiveState['kind'] }) {
    await db
        .delete(syncStateTable)
        .where(and(eq(syncStateTable.kind, input.kind), eq(syncStateTable.id, input.id)));
}

export async function deleteSyncStatesByKindExceptIds(
    kind: SyncPrimitiveState['kind'],
    ids: string[]
) {
    if (ids.length === 0) {
        await db.delete(syncStateTable).where(eq(syncStateTable.kind, kind));
        return;
    }

    await db
        .delete(syncStateTable)
        .where(and(eq(syncStateTable.kind, kind), notInArray(syncStateTable.id, ids)));
}
