import { eq } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { memorySettingsTable } from '../db/schema.ts';
import { type MemorySettings, memorySettingsSchema } from '../memory/contracts.ts';

const memorySettingsId = 'primary';

export async function getStoredMemorySettings() {
    const [record] = await db
        .select()
        .from(memorySettingsTable)
        .where(eq(memorySettingsTable.id, memorySettingsId))
        .limit(1);

    if (!record) {
        return null;
    }

    return memorySettingsSchema.parse(JSON.parse(record.settingsJson));
}

export async function saveStoredMemorySettings(input: Omit<MemorySettings, 'updatedAt'>) {
    const timestamp = new Date().toISOString();
    const settings = memorySettingsSchema.parse({
        ...input,
        updatedAt: timestamp,
    });

    await db
        .insert(memorySettingsTable)
        .values({
            id: memorySettingsId,
            settingsJson: JSON.stringify(settings),
            updatedAt: timestamp,
        })
        .onConflictDoUpdate({
            target: memorySettingsTable.id,
            set: {
                settingsJson: JSON.stringify(settings),
                updatedAt: timestamp,
            },
        });

    return settings;
}
