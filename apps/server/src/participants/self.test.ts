import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { eq } from 'drizzle-orm';

const directory = mkdtempSync(join(tmpdir(), 'tavern-profile-self-'));
const databasePath = join(directory, 'test.sqlite');

process.env.DATABASE_PATH = databasePath;

const [{ ensureDatabaseSchema }, { db, databaseClient }, storage, self, linkSelf] =
    await Promise.all([
        import('../db/bootstrap.ts'),
        import('../db/index.ts'),
        import('../storage/participants.ts'),
        import('./self.ts'),
        import('./link.ts'),
    ]);

ensureDatabaseSchema();

const { profileParticipantsTable } = await import('../db/schema.ts');

test.beforeEach(() => {
    databaseClient.exec('delete from profile_participants');
    databaseClient.exec('delete from participant_labels');
    databaseClient.exec('delete from participants');
    databaseClient.exec('delete from profiles');
});

test('ensureSelfProfile bootstraps the Tavern profile', async () => {
    const profile = await self.ensureSelfProfile();

    assert.equal(profile?.id, self.selfProfileId);
    assert.equal(profile?.displayName, self.selfProfileDefaultName);
});

test('linkParticipantToSelf creates a manual profile link', async () => {
    const timestamp = new Date().toISOString();

    await self.ensureSelfProfile();
    await storage.upsertParticipants([
        {
            accountKey: 'discord-workspace',
            createdAt: timestamp,
            externalId: '123',
            id: 'participant:discord:global:external:123',
            lastSeenAt: timestamp,
            observedName: 'Zack',
            provider: 'discord',
            updatedAt: timestamp,
        },
    ]);

    const participant = await linkSelf.linkParticipantToSelf(
        'participant:discord:global:external:123'
    );

    const links = await db
        .select()
        .from(profileParticipantsTable)
        .where(
            eq(profileParticipantsTable.participantId, 'participant:discord:global:external:123')
        );

    assert.equal(participant?.id, 'participant:discord:global:external:123');
    assert.equal(links[0]?.profileId, self.selfProfileId);
});
