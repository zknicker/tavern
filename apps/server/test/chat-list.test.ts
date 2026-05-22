import { afterEach, mock, test } from 'bun:test';
import assert from 'node:assert/strict';
import type { ChatList } from '../src/chat/contracts.ts';
import { getChat, listChats } from '../src/chat/list.ts';
import { saveTavernChatRecord } from '../src/chat/records.ts';
import { archiveTavernChat } from '../src/chat/save.ts';
import { ensureDatabaseSchema } from '../src/db/bootstrap.ts';
import { databaseClient } from '../src/db/index.ts';
import { syncChatParticipantsForRuntime } from '../src/participants/chat-participants.ts';
import { linkParticipantToSelf } from '../src/participants/link.ts';
import { syncAgentsForRuntime } from '../src/storage/agents.ts';
import { getChatRecord, syncChatsForRuntime } from '../src/storage/chats.ts';
import { syncSessionsForRuntime } from '../src/storage/sessions.ts';

ensureDatabaseSchema();

const planningChatId = '220f46ed-2d7c-41dd-9d7e-d02691f1afc3';
const planningSessionKey = `agent:agent:planner:tavern:channel:${planningChatId}`;
const freshChatId = '5d9b79d7-3193-4c0c-849b-f64225ea7cad';

afterEach(() => {
    mock.restore();
    databaseClient.exec(
        'DELETE FROM session_runs; DELETE FROM chats; DELETE FROM agents; DELETE FROM profile_participants; DELETE FROM participant_labels; DELETE FROM participants; DELETE FROM profiles;'
    );
});

test('listChats returns no rows when there are no chats', async () => {
    const result = await listChats();

    assert.deepEqual(result.ids, []);
    assert.deepEqual(result.itemsById, {});
});

test('listChats prefers runtime chat identity and bindings for Tavern chats', async () => {
    await seedPlanningChat({ includeSession: true });

    const result = await listChats();
    const chats = listedChats(result);

    assert.deepEqual(result.ids, [planningChatId]);
    assert.equal(chats[0]?.displayName, 'Planning');
    assert.equal(chats[0]?.framework, 'tavern');
    assert.equal(chats[0]?.isEnabled, true);
    assert.deepEqual(chats[0]?.boundAgentIds, ['agent:planner']);
    assert.equal('platformMetadata' in (chats[0] ?? {}), false);
});

test('getChat returns full chat detail by id', async () => {
    await seedPlanningChat({ includeSession: true });

    const chat = await getChat({ chatId: planningChatId });

    assert.equal(chat?.id, planningChatId);
    assert.equal(chat?.displayName, 'Planning');
    assert.equal('platformMetadata' in (chat ?? {}), true);
});

test('listChats includes Tavern chats before any synced activity exists', async () => {
    await seedPlanningChat({ includeSession: false });

    const result = await listChats();

    assert.equal(listedChats(result).length, 1);
    assert.equal(listedChats(result)[0]?.id, planningChatId);
    assert.equal(listedChats(result)[0]?.displayName, 'Planning');
    assert.deepEqual(listedChats(result)[0]?.boundAgentIds, ['agent:planner']);
    assert.equal(listedChats(result)[0]?.participants[0]?.name, 'Planner');
    assert.equal(listedChats(result)[0]?.sessionCount, 0);
    assert.equal(listedChats(result)[0]?.lastActivityAt, '2026-04-06T12:01:00.000Z');
});

test('new app-owned Tavern chats sort by chat update time before runtime activity syncs', async () => {
    await seedPlanningChat({ includeSession: true });
    await saveTavernChatRecord({
        chat: {
            bindingId: null,
            bindings: [{ agentId: 'agent:planner' }],
            id: freshChatId,
            inboundMode: 'active',
            metadata: {
                tavern: { displayName: 'Fresh chat' },
                sessionKeys: [],
            },
            parentTarget: null,
            participants: [{ agentId: 'agent:planner', type: 'agent' }],
            platform: 'tavern',
            platformMetadata: null,
            requiresTrigger: false,
            scope: null,
            target: `chat:${freshChatId}`,
            trigger: null,
        },
        runtimeId: 'runtime-1',
        syncedAt: '2026-04-06T12:10:00.000Z',
    });

    const result = await listChats();

    assert.equal(listedChats(result)[0]?.id, freshChatId);
    assert.equal(listedChats(result)[0]?.lastActivityAt, '2026-04-06T12:10:00.000Z');
    assert.equal(listedChats(result)[1]?.id, planningChatId);
});

test('Tavern session sync does not overwrite app-owned chat labels', async () => {
    await seedPlanningChat({ includeSession: false });

    await syncSessionsForRuntime({
        runtimeId: 'runtime-1',
        sessions: [
            {
                agentId: 'agent:planner',
                chatId: planningChatId,
                key: planningSessionKey,
                lastActivityAt: '2026-04-06T12:05:00.000Z',
                messageCount: 2,
                parentSessionKey: null,
                platform: 'tavern',
                sessionId: 'session-1',
                sessionRole: 'main',
                startedAt: '2026-04-06T12:00:00.000Z',
                title: planningChatId,
            },
        ],
    });

    const result = await listChats();

    assert.equal(listedChats(result)[0]?.displayName, 'Planning');
    assert.equal(listedChats(result)[0]?.title, 'Planning');
});

test('listChats hides archived app-owned Tavern chats while synced sessions keep their chat id', async () => {
    await seedPlanningChat({ includeSession: true });

    await archiveTavernChat(planningChatId);

    const result = await listChats();
    const chatRecord = await getChatRecord(planningChatId);

    assert.deepEqual(listedChats(result), []);
    assert.equal(chatRecord?.isArchived, true);
});

test('listChats labels OpenClaw internal runtime sessions by source', async () => {
    await syncAgentsForRuntime({
        agents: [
            {
                avatar: null,
                enabledSkillIds: [],
                emoji: null,
                id: 'main',
                isAdmin: false,
                name: 'Main',
                primaryColor: null,
                workspaceFolder: 'main',
            },
        ],
        runtimeId: 'runtime-1',
    });
    const internalChatId = 'openclaw:internal:agent:main:cron:8300bbe8-7fb6-4ffb-aa7e-7f19005775c6';
    await syncChatsForRuntime({
        chats: [
            {
                bindingId: null,
                bindings: [{ agentId: 'main' }],
                id: internalChatId,
                inboundMode: 'active',
                metadata: {
                    sessionKeys: ['agent:main:cron:8300bbe8-7fb6-4ffb-aa7e-7f19005775c6'],
                },
                parentTarget: null,
                participants: [{ agentId: 'main', type: 'agent' }],
                platform: 'cron',
                platformMetadata: null,
                requiresTrigger: false,
                scope: null,
                target: null,
                trigger: null,
            },
        ],
        runtimeId: 'runtime-1',
    });
    await syncSessionsForRuntime({
        runtimeId: 'runtime-1',
        sessions: [
            {
                agentId: 'main',
                sessionId: 'cron-session-1',
                chatId: internalChatId,
                key: 'agent:main:cron:8300bbe8-7fb6-4ffb-aa7e-7f19005775c6',
                lastActivityAt: '2026-05-02T20:48:22.769Z',
                messageCount: 1,
                parentSessionKey: null,
                platform: 'cron',
                sessionRole: 'main',
                startedAt: '2026-05-02T20:48:15.961Z',
                title: 'Cron: daily-morning-briefing',
            },
        ],
    });

    const result = await listChats();

    assert.equal(listedChats(result)[0]?.source.kind, 'cron');
    assert.equal(listedChats(result)[0]?.source.label, 'Cron');
    assert.equal(listedChats(result)[0]?.displayName, 'Cron session');
    assert.equal(listedChats(result)[0]?.latestSession?.title, 'Cron: daily-morning-briefing');
    assert.equal(listedChats(result)[0]?.title, 'Cron session');
});

test('listChats ignores stale local Tavern chat rows without runtime backing', async () => {
    const result = await listChats();

    assert.deepEqual(listedChats(result), []);
});

test('listChats titles runtime DMs from participants and platform metadata', async () => {
    await syncAgentsForRuntime({
        agents: [
            {
                avatar: null,
                enabledSkillIds: [],
                emoji: null,
                id: 'blippy',
                isAdmin: false,
                name: 'Blippy',
                primaryColor: null,
                workspaceFolder: 'blippy',
            },
        ],
        runtimeId: 'runtime-1',
    });
    const chats = [
        {
            bindingId: null,
            bindings: [{ agentId: 'blippy' }],
            id: 'discord:agent:blippy:dm:user:778786269458464829',
            inboundMode: 'active',
            metadata: {},
            parentTarget: null,
            participants: [
                { agentId: 'blippy', type: 'agent' },
                {
                    accountKey: null,
                    externalId: '778786269458464829',
                    name: 'Zach Knickerbocker',
                    observedLabels: ['Zach Knickerbocker'],
                    participantId: 'participant:discord:global:external:778786269458464829',
                    platform: 'discord',
                    type: 'participant',
                },
            ],
            platform: 'discord',
            platformMetadata: {
                accountIds: [],
                channel: null,
                dm: { userId: '778786269458464829' },
                guild: null,
                observedLabels: ['Zach Knickerbocker'],
                provider: 'discord',
                sourceRecords: [],
                thread: null,
            },
            requiresTrigger: false,
            scope: 'dm',
            target: 'dm:user:778786269458464829',
            trigger: null,
        },
    ];
    await syncChatsForRuntime({
        chats,
        runtimeId: 'runtime-1',
    });
    await syncChatParticipantsForRuntime({
        chats,
        syncedAt: '2026-05-02T20:48:22.769Z',
    });
    await syncSessionsForRuntime({
        runtimeId: 'runtime-1',
        sessions: [
            {
                agentId: 'blippy',
                chatId: 'discord:agent:blippy:dm:user:778786269458464829',
                key: 'agent:blippy:main',
                lastActivityAt: '2026-05-02T20:48:22.769Z',
                messageCount: 2,
                parentSessionKey: null,
                platform: 'discord',
                sessionId: 'session-1',
                sessionRole: 'main',
                startedAt: '2026-05-02T20:48:15.961Z',
                title: 'Zach Knickerbocker',
            },
        ],
    });

    const result = await listChats();

    assert.equal(listedChats(result)[0]?.conversationKind, 'direct');
    assert.equal(listedChats(result)[0]?.title, 'Discord DM Blippy <-> Zach Knickerbocker');
    assert.deepEqual(listedChats(result)[0]?.boundAgentIds, ['blippy']);
});

test('listChats resolves DM targets through participant identities', async () => {
    await syncAgentsForRuntime({
        agents: [
            {
                avatar: null,
                enabledSkillIds: [],
                emoji: null,
                id: 'blippy',
                isAdmin: false,
                name: 'Blippy',
                primaryColor: null,
                workspaceFolder: 'blippy',
            },
            {
                avatar: null,
                enabledSkillIds: [],
                emoji: null,
                id: 'main',
                isAdmin: false,
                name: 'main',
                primaryColor: null,
                workspaceFolder: 'main',
            },
        ],
        runtimeId: 'runtime-1',
    });
    const chats = [
        {
            bindingId: null,
            bindings: [{ agentId: 'blippy' }],
            id: 'discord:agent:blippy:dm:user:778786269458464829',
            inboundMode: 'active' as const,
            metadata: {},
            parentTarget: null,
            participants: [
                { agentId: 'blippy', type: 'agent' as const },
                {
                    accountKey: null,
                    externalId: '778786269458464829',
                    name: 'zknicker',
                    observedLabels: ['zknicker', 'zknicker user id:778786269458464829'],
                    participantId: 'participant:discord:global:external:778786269458464829',
                    platform: 'discord',
                    type: 'participant' as const,
                },
            ],
            platform: 'discord',
            platformMetadata: {
                accountIds: [],
                channel: null,
                dm: { userId: '778786269458464829' },
                guild: null,
                observedLabels: ['zknicker user id:778786269458464829'],
                provider: 'discord' as const,
                sourceRecords: [],
                thread: null,
            },
            requiresTrigger: false,
            scope: 'dm' as const,
            target: 'dm:user:778786269458464829',
            trigger: null,
        },
        {
            bindingId: null,
            bindings: [{ agentId: 'main' }],
            id: 'discord:agent:main:dm:user:778786269458464829',
            inboundMode: 'active' as const,
            metadata: {},
            parentTarget: null,
            participants: [
                { agentId: 'main', type: 'agent' as const },
                {
                    accountKey: null,
                    externalId: '778786269458464829',
                    name: 'Zach Knickerbocker',
                    observedLabels: ['Zach Knickerbocker'],
                    participantId: 'participant:discord:global:external:778786269458464829',
                    platform: 'discord',
                    type: 'participant' as const,
                },
            ],
            platform: 'discord',
            platformMetadata: {
                accountIds: [],
                channel: null,
                dm: { userId: '778786269458464829' },
                guild: null,
                observedLabels: ['Zach Knickerbocker'],
                provider: 'discord' as const,
                sourceRecords: [],
                thread: null,
            },
            requiresTrigger: false,
            scope: 'dm' as const,
            target: 'dm:user:778786269458464829',
            trigger: null,
        },
    ];

    await syncChatsForRuntime({
        chats,
        runtimeId: 'runtime-1',
    });
    await syncChatParticipantsForRuntime({
        chats,
        syncedAt: '2026-05-02T20:48:22.769Z',
    });

    const result = await listChats();
    const dmChats = listedChats(result).filter((chat) => chat.scope === 'dm');

    assert.equal(dmChats.length, 2);
    assert.equal(dmChats[0]?.displayName, 'Zach Knickerbocker');
    assert.equal(dmChats[0]?.targetParticipant?.name, 'Zach Knickerbocker');
    assert.equal(dmChats[1]?.displayName, 'Zach Knickerbocker');
    assert.equal(dmChats[1]?.targetParticipant?.name, 'Zach Knickerbocker');
});

test('DM participant sync preserves manual self profile links', async () => {
    const chats = [
        {
            bindingId: null,
            bindings: [{ agentId: 'blippy' }],
            id: 'discord:agent:blippy:dm:user:778786269458464829',
            inboundMode: 'active' as const,
            metadata: {},
            parentTarget: null,
            participants: [
                { agentId: 'blippy', type: 'agent' as const },
                {
                    accountKey: null,
                    externalId: '778786269458464829',
                    name: 'Zach Knickerbocker',
                    observedLabels: ['Zach Knickerbocker'],
                    participantId: 'participant:discord:global:external:778786269458464829',
                    platform: 'discord',
                    type: 'participant' as const,
                },
            ],
            platform: 'discord',
            platformMetadata: {
                accountIds: [],
                channel: null,
                dm: { userId: '778786269458464829' },
                guild: null,
                observedLabels: ['Zach Knickerbocker'],
                provider: 'discord' as const,
                sourceRecords: [],
                thread: null,
            },
            requiresTrigger: false,
            scope: 'dm' as const,
            target: 'dm:user:778786269458464829',
            trigger: null,
        },
    ];

    await syncAgentsForRuntime({
        agents: [
            {
                avatar: null,
                enabledSkillIds: [],
                emoji: null,
                id: 'blippy',
                isAdmin: false,
                name: 'Blippy',
                primaryColor: null,
                workspaceFolder: 'blippy',
            },
        ],
        runtimeId: 'runtime-1',
    });
    await syncChatsForRuntime({
        chats,
        runtimeId: 'runtime-1',
    });
    await syncChatParticipantsForRuntime({
        chats,
        syncedAt: '2026-05-02T20:48:22.769Z',
    });
    await linkParticipantToSelf('participant:discord:global:external:778786269458464829');
    await syncChatParticipantsForRuntime({
        chats,
        syncedAt: '2026-05-02T21:48:22.769Z',
    });

    const result = await listChats();

    assert.equal(
        listedChats(result)[0]?.targetParticipant?.id,
        'participant:discord:global:external:778786269458464829'
    );
    assert.equal(listedChats(result)[0]?.targetParticipant?.profileId, 'profile:self');
});

function listedChats(result: ChatList) {
    return result.ids.flatMap((chatId) => {
        const chat = result.itemsById[chatId];

        return chat ? [chat] : [];
    });
}

async function seedPlanningChat(input: { includeSession: boolean }) {
    await syncAgentsForRuntime({
        agents: [
            {
                avatar: null,
                enabledSkillIds: [],
                emoji: null,
                id: 'agent:planner',
                isAdmin: false,
                name: 'Planner',
                primaryColor: null,
                workspaceFolder: 'planning',
            },
        ],
        runtimeId: 'runtime-1',
    });
    await saveTavernChatRecord({
        chat: {
            bindingId: null,
            bindings: [{ agentId: 'agent:planner' }],
            id: planningChatId,
            inboundMode: 'active',
            metadata: {
                tavern: { displayName: 'Planning' },
                sessionKeys: input.includeSession ? [planningSessionKey] : [],
            },
            parentTarget: null,
            participants: [{ agentId: 'agent:planner', type: 'agent' }],
            platform: 'tavern',
            platformMetadata: null,
            requiresTrigger: false,
            scope: null,
            target: `chat:${planningChatId}`,
            trigger: null,
        },
        runtimeId: 'runtime-1',
        syncedAt: '2026-04-06T12:01:00.000Z',
    });

    if (!input.includeSession) {
        return;
    }

    await syncSessionsForRuntime({
        runtimeId: 'runtime-1',
        sessions: [
            {
                agentId: 'agent:planner',
                chatId: planningChatId,
                key: planningSessionKey,
                lastActivityAt: '2026-04-06T12:05:00.000Z',
                messageCount: 2,
                parentSessionKey: null,
                platform: 'tavern',
                sessionId: 'session-1',
                sessionRole: 'main',
                startedAt: '2026-04-06T12:00:00.000Z',
                title: 'Planning',
            },
        ],
    });
}
