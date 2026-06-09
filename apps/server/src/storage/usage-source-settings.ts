import { eq } from 'drizzle-orm';
import type { z } from 'zod';
import { db } from '../db/index.ts';
import { usageSourceSettingsTable } from '../db/schema.ts';

export const usageSourceSettingIds = {
    openRouter: 'openrouter',
} as const;

export async function getUsageSourceSettings<T>(input: { id: string; schema: z.ZodType<T> }) {
    const [record] = await db
        .select()
        .from(usageSourceSettingsTable)
        .where(eq(usageSourceSettingsTable.id, input.id))
        .limit(1);

    if (!record) {
        return null;
    }

    return {
        settings: input.schema.parse(JSON.parse(record.settingsJson)),
        updatedAt: record.updatedAt,
    };
}

export async function saveUsageSourceSettings(input: { id: string; settings: unknown }) {
    const timestamp = new Date().toISOString();
    const settingsJson = JSON.stringify(input.settings);

    await db
        .insert(usageSourceSettingsTable)
        .values({
            createdAt: timestamp,
            id: input.id,
            settingsJson,
            updatedAt: timestamp,
        })
        .onConflictDoUpdate({
            target: usageSourceSettingsTable.id,
            set: {
                settingsJson,
                updatedAt: timestamp,
            },
        });

    return {
        updatedAt: timestamp,
    };
}

export async function deleteUsageSourceSettings(id: string) {
    await db.delete(usageSourceSettingsTable).where(eq(usageSourceSettingsTable.id, id));
}
