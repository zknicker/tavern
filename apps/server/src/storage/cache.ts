import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.ts';
import { cachedDocumentsTable } from '../db/schema.ts';

export const cachedDocumentIdSchema = z.enum([
    'memory-graph',
    'model-inventory-claude',
    'model-inventory-codex',
    'model-inventory-openrouter',
]);

export type CachedDocumentId = z.infer<typeof cachedDocumentIdSchema>;

export async function loadCachedDocument<TSchema extends z.ZodType>(
    id: CachedDocumentId,
    schema: TSchema
): Promise<z.infer<TSchema> | null> {
    const [record] = await db
        .select()
        .from(cachedDocumentsTable)
        .where(eq(cachedDocumentsTable.id, id))
        .limit(1);

    if (!record) {
        return null;
    }

    return schema.parse(JSON.parse(record.dataJson));
}

export async function saveCachedDocument(id: CachedDocumentId, value: unknown) {
    const timestamp = new Date().toISOString();

    await db
        .insert(cachedDocumentsTable)
        .values({
            dataJson: JSON.stringify(value),
            id,
            updatedAt: timestamp,
        })
        .onConflictDoUpdate({
            target: cachedDocumentsTable.id,
            set: {
                dataJson: JSON.stringify(value),
                updatedAt: timestamp,
            },
        });
}

export async function deleteCachedDocument(id: CachedDocumentId) {
    await db.delete(cachedDocumentsTable).where(eq(cachedDocumentsTable.id, id));
}
