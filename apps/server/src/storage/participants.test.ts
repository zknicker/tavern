import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const directory = mkdtempSync(join(tmpdir(), 'tavern-participants-'));
const databasePath = join(directory, 'test.sqlite');

process.env.DATABASE_PATH = databasePath;

const [{ ensureDatabaseSchema }, storage, self, { databaseClient }] = await Promise.all([
    import('../db/bootstrap.ts'),
    import('./participants.ts'),
    import('../participants/self.ts'),
    import('../db/index.ts'),
]);

ensureDatabaseSchema();

test.beforeEach(() => {
    databaseClient.exec('delete from profile_participants');
    databaseClient.exec('delete from participant_labels');
    databaseClient.exec('delete from participants');
    databaseClient.exec('delete from profiles');
});

test('listParticipants returns one observed source identity with label history', async () => {
    const timestamp = new Date().toISOString();

    await storage.upsertParticipants([
        {
            accountKey: 'global',
            createdAt: timestamp,
            externalId: '778786269458464829',
            id: 'participant:discord:global:external:778786269458464829',
            lastSeenAt: '2026-05-02T21:48:22.769Z',
            observedName: 'Zach Knickerbocker',
            provider: 'discord',
            updatedAt: timestamp,
        },
    ]);
    await storage.upsertParticipantLabels([
        {
            createdAt: timestamp,
            id: 'participant:discord:global:external:778786269458464829:label:zknicker',
            label: 'zknicker',
            lastSeenAt: '2026-05-02T20:48:22.769Z',
            normalizedLabel: 'zknicker',
            participantId: 'participant:discord:global:external:778786269458464829',
            updatedAt: timestamp,
        },
        {
            createdAt: timestamp,
            id: 'participant:discord:global:external:778786269458464829:label:zach',
            label: 'Zach Knickerbocker',
            lastSeenAt: '2026-05-02T21:48:22.769Z',
            normalizedLabel: 'zachknickerbocker',
            participantId: 'participant:discord:global:external:778786269458464829',
            updatedAt: timestamp,
        },
    ]);

    const participant = await storage.getParticipant(
        'participant:discord:global:external:778786269458464829'
    );

    assert.equal(participant?.provider, 'discord');
    assert.equal(participant?.externalId, '778786269458464829');
    assert.equal(participant?.linkedProfile, null);
    assert.deepEqual(participant?.labels, ['Zach Knickerbocker', 'zknicker']);
});

test('profile links do not merge or delete participants', async () => {
    const timestamp = new Date().toISOString();

    await self.ensureSelfProfile();
    await storage.upsertParticipants([
        {
            accountKey: 'global',
            createdAt: timestamp,
            externalId: '778786269458464829',
            id: 'participant:discord:global:external:778786269458464829',
            lastSeenAt: timestamp,
            observedName: 'Zack',
            provider: 'discord',
            updatedAt: timestamp,
        },
    ]);

    await storage.linkParticipantToProfile({
        participantId: 'participant:discord:global:external:778786269458464829',
        profileId: self.selfProfileId,
    });

    const participant = await storage.getParticipant(
        'participant:discord:global:external:778786269458464829'
    );
    const participants = await storage.listParticipants();

    assert.equal(participant?.linkedProfile?.id, self.selfProfileId);
    assert.equal(participants.length, 1);
    assert.equal(participants[0]?.id, 'participant:discord:global:external:778786269458464829');
});

test('resolveParticipantIdsForObservedSenders prefers external ids over labels', async () => {
    const timestamp = new Date().toISOString();

    await storage.upsertParticipants([
        {
            accountKey: 'global',
            createdAt: timestamp,
            externalId: '778786269458464829',
            id: 'participant:discord:global:external:778786269458464829',
            lastSeenAt: timestamp,
            observedName: 'Zack',
            provider: 'discord',
            updatedAt: timestamp,
        },
    ]);
    await storage.upsertParticipantLabels([
        {
            createdAt: timestamp,
            id: 'participant:discord:global:external:778786269458464829:label:zack',
            label: 'Zack (778786269458464829)',
            lastSeenAt: timestamp,
            normalizedLabel: 'zack',
            participantId: 'participant:discord:global:external:778786269458464829',
            updatedAt: timestamp,
        },
    ]);

    const resolved = await storage.resolveParticipantIdsForObservedSenders([
        {
            key: 'message-1',
            provider: 'discord',
            senderLabel: 'Zack (778786269458464829)',
        },
    ]);

    assert.equal(
        resolved.get('message-1'),
        'participant:discord:global:external:778786269458464829'
    );
});
