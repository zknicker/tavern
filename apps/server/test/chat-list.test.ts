import { afterEach, beforeEach, mock, test } from 'bun:test';
import assert from 'node:assert/strict';
import type { AgentRuntimeChat, TavernChat } from '@tavern/api';
import { listAgentChats } from '../src/agents/chats.ts';
import type { ChatList } from '../src/chat/contracts.ts';
import { getChat, listChats } from '../src/chat/list.ts';
import { archiveTavernChat, setTavernChatPinned } from '../src/chat/save.ts';
import { ensureDatabaseSchema } from '../src/db/bootstrap.ts';
import { databaseClient } from '../src/db/index.ts';
import { syncChatParticipantsForRuntime } from '../src/participants/chat-participants.ts';
import { saveAgentRuntimeConnection } from '../src/storage/agent-runtime-connections.ts';
import { syncAgentsForRuntime } from '../src/storage/agents.ts';
import {
    listSessionRecords,
    parseSessionRecord,
    syncSessionsForRuntime,
} from '../src/storage/sessions.ts';

ensureDatabaseSchema();

const planningChatId = '220f46ed-2d7c-41dd-9d7e-d02691f1afc3';
const planningSessionKey = `agent:agent:planner:tavern:channel:${planningChatId}`;
const freshChatId = '5d9b79d7-3193-4c0c-849b-f64225ea7cad';
const originalFetch = globalThis.fetch;
let runtimeChats: AgentRuntimeChat[] = [];
let tavernChats: TavernChat[] = [];

beforeEach(async () => {
    runtimeChats = [];
    tavernChats = [];
    globalThis.fetch = mockRuntimeFetch as typeof fetch;
    await saveAgentRuntimeConnection({
        baseUrl: 'http://runtime.test',
        enabled: true,
        id: 'runtime-1',
        isActive: true,
        lastCheckedAt: '2026-04-06T12:10:00.000Z',
        lastError: null,
        name: 'Runtime',
    });
});

afterEach(() => {
    mock.restore();
    globalThis.fetch = originalFetch;
    databaseClient.exec(
        'DELETE FROM session_runs; DELETE FROM agents; DELETE FROM agent_runtime_connections; DELETE FROM participant_labels; DELETE FROM participants;'
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
    assert.equal(listedChats(result)[0]?.isPinned, false);
    assert.equal(listedChats(result)[0]?.lastActivityAt, '2026-04-06T12:01:00.000Z');
});

test('listChats exposes pinned Tavern chat state', async () => {
    await seedPlanningChat({ includeSession: false, pinned: true });

    const result = await listChats();

    assert.equal(listedChats(result)[0]?.id, planningChatId);
    assert.equal(listedChats(result)[0]?.isPinned, true);
});

test('setTavernChatPinned persists pinned state in Runtime chat storage', async () => {
    await seedPlanningChat({ includeSession: false });

    await setTavernChatPinned({ chatId: planningChatId, pinned: true });

    assert.equal(tavernChats[0]?.pinned, true);
    assert.equal(listedChats(await listChats())[0]?.isPinned, true);
});

test('new Runtime-owned Tavern chats sort by chat update time before runtime activity syncs', async () => {
    await seedPlanningChat({ includeSession: true });
    tavernChats.push(
        runtimeTavernChat({
            agentIds: ['agent:planner'],
            displayName: 'Fresh chat',
            id: freshChatId,
            updatedAt: '2026-04-06T12:10:00.000Z',
        })
    );

    const result = await listChats();

    assert.equal(listedChats(result)[0]?.id, freshChatId);
    assert.equal(listedChats(result)[0]?.lastActivityAt, '2026-04-06T12:10:00.000Z');
    assert.equal(listedChats(result)[1]?.id, planningChatId);
});

test('Tavern session sync does not overwrite Runtime-owned chat labels', async () => {
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

test('listChats hides archived Runtime-owned Tavern chats while synced sessions keep their chat id', async () => {
    await seedPlanningChat({ includeSession: true });

    await archiveTavernChat(planningChatId);

    const result = await listChats();

    assert.deepEqual(listedChats(result), []);
    assert.equal(
        (tavernChats[0]?.metadata.tavern as { archived?: boolean } | undefined)?.archived,
        true
    );
});

test('agent chat list labels Hermes internal runtime sessions by source', async () => {
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
    const internalChatId = 'hermes:internal:agent:main:cron:8300bbe8-7fb6-4ffb-aa7e-7f19005775c6';
    runtimeChats = [
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
    ];
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

    const sidebarResult = await listChats();
    const result = await listAgentChats({ agentId: 'main' });

    assert.deepEqual(sidebarResult.ids, []);
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

test('getChat result matches the corresponding listChatDetails entry for each active chat', async () => {
    const chatBId = 'b1b1b1b1-0000-0000-0000-000000000001';
    const chatCId = 'c2c2c2c2-0000-0000-0000-000000000002';

    await seedPlanningChat({ includeSession: true });
    tavernChats.push(
        runtimeTavernChat({
            agentIds: ['agent:planner'],
            displayName: 'Chat B',
            id: chatBId,
            updatedAt: '2026-04-06T11:00:00.000Z',
        })
    );
    tavernChats.push(
        runtimeTavernChat({
            agentIds: ['agent:planner'],
            displayName: 'Chat C',
            id: chatCId,
            updatedAt: '2026-04-06T10:00:00.000Z',
        })
    );

    const allDetails = await import('../src/chat/list.ts').then((m) =>
        m.listChatDetails({ includeExternal: false })
    );
    const { chatSchema } = await import('../src/chat/contracts.ts');

    for (const detail of allDetails) {
        const viaSingle = await getChat({ chatId: detail.id });

        assert.ok(viaSingle !== null, `getChat returned null for active chat ${detail.id}`);
        assert.deepEqual(viaSingle, chatSchema.parse(detail));
    }

    assert.equal(allDetails.length, 3);
});

test('getChat returns null for an archived Tavern chat', async () => {
    await seedPlanningChat({ includeSession: false });
    await archiveTavernChat(planningChatId);

    const result = await getChat({ chatId: planningChatId });

    assert.equal(result, null);
});

test('getChat returns null for an unknown chat id and does not throw', async () => {
    const result = await getChat({ chatId: 'does-not-exist' });

    assert.equal(result, null);
});

test('agent chat list keeps non-Tavern session-only runtime surfaces visible', async () => {
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
    const internalChatId = 'hermes:internal:agent:main:cron:session-only';

    await syncSessionsForRuntime({
        runtimeId: 'runtime-1',
        sessions: [
            {
                agentId: 'main',
                chatId: internalChatId,
                key: 'agent:main:cron:session-only',
                lastActivityAt: '2026-05-02T20:48:22.769Z',
                messageCount: 1,
                parentSessionKey: null,
                platform: 'cron',
                sessionId: 'cron-session-only',
                sessionRole: 'main',
                startedAt: '2026-05-02T20:48:15.961Z',
                title: 'Cron: session-only',
            },
        ],
    });

    const result = await listAgentChats({ agentId: 'main' });
    const [chat] = listedChats(result);

    assert.equal(chat?.id, internalChatId);
    assert.deepEqual(chat?.boundAgentIds, ['main']);
    assert.equal(chat?.source.kind, 'cron');
    assert.equal(chat?.displayName, 'Cron session');
    assert.equal(chat?.latestSession?.title, 'Cron: session-only');
});

test('agent chat list titles runtime DMs from participants and platform metadata', async () => {
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
    runtimeChats = chats;
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

    const result = await listAgentChats({ agentId: 'blippy' });

    assert.equal(listedChats(result)[0]?.conversationKind, 'direct');
    assert.equal(listedChats(result)[0]?.title, 'Discord DM Blippy <-> Zach Knickerbocker');
    assert.deepEqual(listedChats(result)[0]?.boundAgentIds, ['blippy']);
});

test('agent chat list resolves DM targets through participant identities', async () => {
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

    runtimeChats = chats;
    await syncChatParticipantsForRuntime({
        chats,
        syncedAt: '2026-05-02T20:48:22.769Z',
    });

    const result = await listAgentChats({ agentId: 'blippy' });
    const dmChats = listedChats(result).filter((chat) => chat.scope === 'dm');

    assert.equal(dmChats.length, 1);
    assert.equal(dmChats[0]?.displayName, 'Zach Knickerbocker');
    assert.equal(dmChats[0]?.targetParticipant?.name, 'Zach Knickerbocker');
});

function listedChats(result: ChatList) {
    return result.ids.flatMap((chatId) => {
        const chat = result.itemsById[chatId];

        return chat ? [chat] : [];
    });
}

async function mockRuntimeFetch(input: RequestInfo | URL, init?: RequestInit) {
    const request = new Request(input, init);
    const url = new URL(request.url);

    if (url.pathname === '/agents' && request.method === 'GET') {
        return Response.json({
            agents: [
                runtimeAgent('agent:planner', 'Planner', 'planning'),
                runtimeAgent('blippy', 'Blippy', 'blippy'),
                runtimeAgent('main', 'Main', 'main'),
                runtimeAgent('support', 'Support', 'support'),
            ],
        });
    }

    if (url.pathname === '/api/chats' && request.method === 'GET') {
        return Response.json({
            chats: tavernChats,
            next_cursor: null,
        });
    }

    if (url.pathname === '/hermes/chats' && request.method === 'GET') {
        return Response.json({ chats: runtimeChats });
    }

    if (url.pathname === '/hermes/sessions' && request.method === 'GET') {
        return Response.json({
            sessions: (await listSessionRecords()).flatMap((record) => {
                const session = parseSessionRecord(record);
                return session ? [session] : [];
            }),
        });
    }

    const chatMatch = url.pathname.match(/^\/api\/chats\/([^/]+)$/u);
    if (chatMatch && request.method === 'GET') {
        const chat = tavernChats.find((entry) => entry.id === decodeURIComponent(chatMatch[1]));

        return chat ? Response.json(chat) : new Response('Not found', { status: 404 });
    }

    if (url.pathname === '/api/chats' && request.method === 'POST') {
        const body = (await request.json()) as {
            id: string;
            metadata?: Record<string, unknown>;
            pinned?: boolean;
            title?: string | null;
        };
        const existing = tavernChats.find((entry) => entry.id === body.id);
        const chat = runtimeTavernChat({
            agentIds: readAgentIds(body.metadata),
            archived: readArchived(body.metadata),
            displayName: readDisplayName(body.metadata) ?? body.title ?? body.id,
            id: body.id,
            pinned: body.pinned ?? existing?.pinned ?? false,
            updatedAt: '2026-04-06T12:30:00.000Z',
        });
        const existingIndex = tavernChats.findIndex((entry) => entry.id === body.id);

        if (existingIndex >= 0) {
            tavernChats[existingIndex] = chat;
        } else {
            tavernChats.push(chat);
        }

        return Response.json(chat);
    }

    return new Response('Not found', { status: 404 });
}

function runtimeAgent(id: string, name: string, workspaceFolder: string) {
    return {
        avatar: null,
        enabledSkillIds: [],
        emoji: null,
        id,
        isAdmin: false,
        name,
        primaryColor: null,
        workspaceFolder,
    };
}

function runtimeTavernChat(input: {
    agentIds: string[];
    archived?: boolean;
    displayName: string;
    id: string;
    pinned?: boolean;
    updatedAt: string;
}): TavernChat {
    return {
        created_at: input.updatedAt,
        id: input.id,
        last_message_sequence: 0,
        metadata: {
            runtime: {
                source: 'tavern',
            },
            sessionKeys: input.agentIds.map(
                (agentId) => `agent:${agentId}:tavern:channel:${input.id}`
            ),
            tavern: {
                agentIds: input.agentIds,
                archived: input.archived ?? false,
                displayName: input.displayName,
            },
        },
        pinned: input.pinned ?? false,
        title: input.displayName,
        updated_at: input.updatedAt,
    };
}

function readTavernMetadata(metadata: Record<string, unknown> | undefined) {
    return typeof metadata?.tavern === 'object' && metadata.tavern !== null
        ? (metadata.tavern as Record<string, unknown>)
        : {};
}

function readAgentIds(metadata: Record<string, unknown> | undefined) {
    const tavern = readTavernMetadata(metadata);

    return Array.isArray(tavern.agentIds)
        ? tavern.agentIds.filter((agentId): agentId is string => typeof agentId === 'string')
        : [];
}

function readArchived(metadata: Record<string, unknown> | undefined) {
    return readTavernMetadata(metadata).archived === true;
}

function readDisplayName(metadata: Record<string, unknown> | undefined) {
    const displayName = readTavernMetadata(metadata).displayName;

    return typeof displayName === 'string' ? displayName : null;
}

async function seedPlanningChat(input: { includeSession: boolean; pinned?: boolean }) {
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
    tavernChats.push(
        runtimeTavernChat({
            agentIds: ['agent:planner'],
            displayName: 'Planning',
            id: planningChatId,
            pinned: input.pinned,
            updatedAt: '2026-04-06T12:01:00.000Z',
        })
    );

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
