import { afterEach, mock, spyOn, test } from 'bun:test';
import assert from 'node:assert/strict';
import * as catalog from '../agents/catalog.ts';
import * as runtimeSessions from '../sessions/runtime-sessions.ts';
import * as participants from '../storage/participants.ts';
import { getChat, listArchivedChats, listChats } from './list.ts';
import * as runtimeChats from './runtime-chats.ts';

afterEach(() => {
    mock.restore();
});

test('listChats excludes archived chats and marks active chats unarchived', async () => {
    mockChatListDependencies([
        buildTavernRuntimeChatRecord({ archived: false, id: 'cht_active' }),
        buildTavernRuntimeChatRecord({ archived: true, id: 'cht_archived' }),
    ]);

    const result = await listChats();

    assert.deepEqual(result.ids, ['cht_active']);
    assert.equal(result.itemsById.cht_active?.archived, false);
});

test('listArchivedChats returns only archived chats', async () => {
    mockChatListDependencies([
        buildTavernRuntimeChatRecord({ archived: false, id: 'cht_active' }),
        buildTavernRuntimeChatRecord({ archived: true, id: 'cht_archived' }),
    ]);

    const result = await listArchivedChats();

    assert.deepEqual(result.ids, ['cht_archived']);
    assert.equal(result.itemsById.cht_archived?.archived, true);
});

test('getChat resolves archived chats so their history stays reachable', async () => {
    mockChatListDependencies([
        buildTavernRuntimeChatRecord({ archived: true, id: 'cht_archived' }),
    ]);

    const chat = await getChat({ chatId: 'cht_archived' });

    assert.equal(chat?.id, 'cht_archived');
    assert.equal(chat?.archived, true);
});

function mockChatListDependencies(records: runtimeChats.RuntimeChatRecord[]) {
    spyOn(catalog, 'listAgents').mockResolvedValue([]);
    spyOn(participants, 'listParticipants').mockResolvedValue([]);
    spyOn(participants, 'resolveParticipantIdsForSourceIdentities').mockResolvedValue(new Map());
    spyOn(runtimeSessions, 'listRuntimeSessions').mockResolvedValue([]);
    spyOn(runtimeChats, 'listRuntimeChatRecords').mockResolvedValue(records);
}

function buildTavernRuntimeChatRecord(input: { archived: boolean; id: string }) {
    return {
        chat: {
            activeTurnParticipantIds: [],
            bindingId: null,
            bindings: [],
            id: input.id,
            inboundMode: 'active',
            metadata: {
                tavern: {
                    agentIds: [],
                    archived: input.archived,
                    displayName: input.id,
                    displayNameSource: 'explicit',
                    tabAppearance: { color: null },
                },
            },
            parentTarget: null,
            participants: [],
            platform: 'tavern',
            platformMetadata: {
                chatId: input.id,
                conversationId: null,
                observedLabels: [input.id],
                provider: 'tavern',
                sourceRecords: [],
            },
            requiresTrigger: false,
            scope: 'channel',
            target: `channel:${input.id}`,
            trigger: null,
        },
        createdAt: '2026-07-01T00:00:00.000Z',
        lastActivityAt: '2026-07-02T00:00:00.000Z',
        runtimeId: 'rt_1',
        updatedAt: '2026-07-02T00:00:00.000Z',
    } as runtimeChats.RuntimeChatRecord;
}
