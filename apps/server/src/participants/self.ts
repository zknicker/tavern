import { eq } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { profilesTable } from '../db/schema.ts';

export const selfProfileId = 'profile:self';
export const selfProfileDefaultName = 'Tavern';

export async function ensureSelfProfile() {
    const timestamp = new Date().toISOString();

    await db
        .insert(profilesTable)
        .values({
            avatar: null,
            createdAt: timestamp,
            displayName: selfProfileDefaultName,
            id: selfProfileId,
            primaryColor: '#64748b',
            updatedAt: timestamp,
        })
        .onConflictDoNothing();

    return await getSelfProfile();
}

export async function getSelfProfile() {
    const [profile] = await db
        .select()
        .from(profilesTable)
        .where(eq(profilesTable.id, selfProfileId))
        .limit(1);

    return profile ?? null;
}

export async function saveSelfProfile(input: {
    avatar: string | null;
    displayName: string | null;
    primaryColor: string | null;
}) {
    await ensureSelfProfile();

    const timestamp = new Date().toISOString();

    await db
        .update(profilesTable)
        .set({
            avatar: input.avatar,
            displayName: input.displayName,
            primaryColor: input.primaryColor,
            updatedAt: timestamp,
        })
        .where(eq(profilesTable.id, selfProfileId));

    return await getSelfProfile();
}
