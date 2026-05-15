import assert from 'node:assert/strict';
import test from 'node:test';
import {
    buildSessionCards,
    getSessionPane,
    groupSessionCards,
    groupSessionCardsWithOptions,
    type SessionCardData,
    sessionPaneLimit,
} from './session-list-data.ts';

function createSessionCard(overrides: Partial<SessionCardData['session']> = {}) {
    const session = {
        agentId: 'agent-1',
        agentName: 'Claw',
        id: 'session-1',
        key: 'agent:main:discord:channel:session-1',
        lastActivity: '1m ago',
        messageCount: 12,
        name: '#general',
        platform: 'discord',
        searchText: 'claw\n#general',
        source: 'discord:123#general',
        startedAt: '2026-03-20T14:00:00.000Z',
        type: 'chat' as const,
        ...overrides,
    };

    return {
        id: session.id,
        label: session.name,
        lastActivity: session.lastActivity,
        searchText: session.searchText,
        session,
        source: session.source,
        type: session.type,
    } satisfies SessionCardData;
}

test('buildSessionCards keeps one card per session even for identical sources', () => {
    const cards = buildSessionCards([
        createSessionCard({
            agentId: 'agent-1',
            agentName: 'Claw',
            id: 'session-1',
            startedAt: '2026-03-20T14:00:00.000Z',
        }).session,
        createSessionCard({
            agentId: 'agent-2',
            agentName: 'Flicker',
            id: 'session-2',
            startedAt: '2026-03-20T14:01:00.000Z',
        }).session,
        createSessionCard({
            agentId: 'agent-3',
            agentName: 'Tiny',
            id: 'session-3',
            startedAt: '2026-03-20T14:02:00.000Z',
        }).session,
        createSessionCard({
            agentId: 'agent-3',
            agentName: 'Tiny',
            id: 'session-4',
            startedAt: '2026-03-20T14:03:00.000Z',
        }).session,
    ]);

    assert.deepEqual(
        cards.map((card) => ({
            agent: card.session.agentName,
            id: card.id,
            label: card.label,
        })),
        [
            { agent: 'Tiny', id: 'session-4', label: '#general' },
            { agent: 'Tiny', id: 'session-3', label: '#general' },
            { agent: 'Flicker', id: 'session-2', label: '#general' },
            { agent: 'Claw', id: 'session-1', label: '#general' },
        ]
    );
});

test('getSessionPane routes session cards into dedicated panes', () => {
    const chatCard = createSessionCard();
    const cronCard = createSessionCard({
        id: 'cron-1',
        key: 'agent:main:cron:job-1',
        name: 'Reminder Poller',
        source: 'Cron: Reminder Poller',
        type: 'cron',
    });
    const conversationCard = createSessionCard({
        id: 'chat-1',
        key: 'agent:main:session:chat-1',
        name: 'Planning',
        source: 'Planning',
        type: 'chat',
    });

    assert.equal(getSessionPane(chatCard), 'conversations');
    assert.equal(getSessionPane(cronCard), 'cron');
    assert.equal(getSessionPane(conversationCard), 'conversations');
});

test('groupSessionCards partitions cards by pane', () => {
    const groups = groupSessionCards([
        createSessionCard({
            id: 'discord-1',
            key: 'agent:main:discord:channel:session-1',
            type: 'chat',
        }),
        createSessionCard({
            id: 'cron-1',
            key: 'agent:main:cron:job-1',
            source: 'Cron: Reminder Poller',
            type: 'cron',
        }),
        createSessionCard({
            id: 'session-2',
            key: 'agent:main:session:chat-1',
            source: 'Design Review',
            type: 'chat',
        }),
    ]);

    assert.deepEqual(
        {
            conversations: groups.conversations.map((card) => card.id),
            cron: groups.cron.map((card) => card.id),
        },
        {
            conversations: ['discord-1', 'session-2'],
            cron: ['cron-1'],
        }
    );
});

test('groupSessionCards caps each pane to the most recent cards', () => {
    const groups = groupSessionCards(
        Array.from({ length: sessionPaneLimit + 2 }, (_, index) =>
            createSessionCard({
                id: `discord-${index}`,
                key: `agent:main:discord:channel:session-${index}`,
                startedAt: `2026-03-20T14:${String(index).padStart(2, '0')}:00.000Z`,
                type: 'chat',
            })
        )
    );

    assert.equal(groups.conversations.length, sessionPaneLimit);
    assert.deepEqual(
        groups.conversations.map((card) => card.id),
        Array.from(
            { length: sessionPaneLimit },
            (_, index) => `discord-${sessionPaneLimit + 1 - index}`
        )
    );
});

test('groupSessionCardsWithOptions keeps a focused session visible', () => {
    const groups = groupSessionCardsWithOptions(
        Array.from({ length: sessionPaneLimit + 2 }, (_, index) =>
            createSessionCard({
                id: `session-${index}`,
                key: `agent:main:session:${index}`,
                startedAt: `2026-03-20T14:${String(index).padStart(2, '0')}:00.000Z`,
                type: 'chat',
            })
        ),
        {
            focusedSessionKey: 'agent:main:session:11',
        }
    );

    assert.equal(groups.conversations.length, sessionPaneLimit);
    assert.equal(groups.conversations[0]?.session.key, 'agent:main:session:11');
});
