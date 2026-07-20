import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { ChatCardHeader } from './chat-card-header.tsx';

test('ChatCardHeader renders chat labels and omits session link blocks', () => {
    const sessionKey = 'portal:chat:atlas:c8b38c6e';
    const markup = renderToStaticMarkup(
        <ChatCardHeader
            chat={{
                archived: false,
                boundAgentIds: [],
                canSend: false,
                conversationKind: 'channel',
                createdAt: '2026-05-01T12:00:00.000Z',
                description: null,
                displayName: 'general',
                framework: 'discord',
                activeTurnParticipantIds: [],
                unreadCount: 0,
                hasActivity: true,
                id: 'chat-1',
                isDisabled: false,
                isEnabled: true,
                lastActivityAt: '2026-03-31T14:57:00.000Z',
                latestSession: {
                    agentId: 'main',
                    lastActivityAt: '2026-03-31T14:57:00.000Z',
                    platform: 'tavern',
                    sessionId: null,
                    sessionKey,
                    title: 'portal:chat',
                },
                participants: [
                    {
                        actorId: 'zknicker',
                        actorType: 'participant',
                        avatar: null,
                        name: 'Zach Knickerbocker',
                        primaryColor: null,
                    },
                    {
                        actorId: 'tiny',
                        actorType: 'agent',
                        avatar: null,
                        name: 'Tiny',
                        primaryColor: null,
                    },
                ],
                agentRuntimeSync: null,
                agentRuntimeSyncLabel: null,
                scope: 'channel',
                searchText: '',
                sessionCount: 1,
                source: { kind: 'discord', label: 'Discord' },
                systemPrompt: null,
                tabAppearance: { color: null },
                targetParticipant: null,
                title: '#general',
                type: 'discord',
            }}
        />
    );

    assert.match(markup, /#general/);
    assert.match(markup, new RegExp(sessionKey));
    assert.doesNotMatch(markup, /discord:1090835947375054888#general/);
    assert.doesNotMatch(markup, /1d ago/);
});

test('ChatCardHeader derives runtime DM titles from chat primitives', () => {
    const markup = renderToStaticMarkup(
        <ChatCardHeader
            chat={{
                archived: false,
                boundAgentIds: ['runtime:blippy'],
                canSend: true,
                conversationKind: 'direct',
                createdAt: '2026-05-01T12:00:00.000Z',
                description: null,
                displayName: 'zknicker user id:778786269458464829',
                framework: 'agentRuntime',
                activeTurnParticipantIds: [],
                unreadCount: 0,
                hasActivity: true,
                id: 'runtime:discord:agent:blippy:dm:user:778786269458464829',
                isDisabled: false,
                isEnabled: true,
                lastActivityAt: '2026-05-02T20:48:22.769Z',
                latestSession: null,
                participants: [
                    {
                        actorId: 'runtime:blippy',
                        actorType: 'agent',
                        avatar: null,
                        name: 'Blippy',
                        primaryColor: null,
                    },
                ],
                agentRuntimeSync: null,
                agentRuntimeSyncLabel: null,
                scope: 'dm',
                searchText: '',
                sessionCount: 1,
                source: { kind: 'discord', label: 'Discord' },
                systemPrompt: null,
                tabAppearance: { color: null },
                targetParticipant: {
                    avatar: 'ZK',
                    id: 'participant:discord:global:external:778786269458464829',
                    name: 'Zach',
                    observedName: 'Zach Knickerbocker',
                    primaryColor: null,
                },
                title: 'zknicker user id:778786269458464829',
                type: 'discord',
            }}
        />
    );

    assert.match(markup, /Discord/);
    assert.match(markup, /Blippy/);
    assert.match(markup, /Zach/);
    assert.doesNotMatch(markup, /Discord DM/);
    assert.doesNotMatch(markup, /zknicker user id/);
});

test('ChatCardHeader badges first-party Tavern chats by provider', () => {
    const markup = renderToStaticMarkup(
        <ChatCardHeader
            chat={{
                archived: false,
                boundAgentIds: ['blippy'],
                canSend: true,
                conversationKind: 'direct',
                createdAt: '2026-05-01T12:00:00.000Z',
                description: null,
                displayName: 'Hey Blippy!',
                framework: 'agentRuntime',
                activeTurnParticipantIds: [],
                unreadCount: 0,
                hasActivity: false,
                id: '220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                isDisabled: false,
                isEnabled: true,
                lastActivityAt: null,
                latestSession: {
                    agentId: 'blippy',
                    sessionId: null,
                    lastActivityAt: null,
                    platform: 'tavern',
                    sessionKey: 'agent:blippy:main',
                    title: null,
                },
                participants: [
                    {
                        actorId: 'blippy',
                        actorType: 'agent',
                        avatar: null,
                        name: 'Blippy',
                        primaryColor: null,
                    },
                ],
                agentRuntimeSync: null,
                agentRuntimeSyncLabel: null,
                scope: null,
                searchText: '',
                sessionCount: 1,
                source: { kind: 'tavern', label: 'Tavern' },
                systemPrompt: null,
                tabAppearance: { color: null },
                targetParticipant: null,
                title: 'Hey Blippy!',
                type: 'tavern',
            }}
        />
    );

    assert.match(markup, /Tavern/);
    assert.match(markup, /Hey Blippy!/);
    assert.doesNotMatch(markup, /Tavern Hey Blippy!/);
    assert.doesNotMatch(markup, /DM/);
});

test('ChatCardHeader omits duplicate badges for system sessions', () => {
    const markup = renderToStaticMarkup(
        <ChatCardHeader
            chat={{
                archived: false,
                boundAgentIds: ['main'],
                canSend: false,
                conversationKind: 'channel',
                createdAt: '2026-05-01T12:00:00.000Z',
                description: null,
                displayName: 'System session',
                framework: 'agentRuntime',
                activeTurnParticipantIds: [],
                unreadCount: 0,
                hasActivity: true,
                id: 'runtime:agent-engine:internal:agent:main:main',
                isDisabled: true,
                isEnabled: false,
                lastActivityAt: '2026-05-08T18:10:15.508Z',
                latestSession: {
                    agentId: 'main',
                    sessionId: null,
                    lastActivityAt: '2026-05-08T18:10:15.508Z',
                    platform: 'webchat',
                    sessionKey: 'agent:main:main',
                    title: 'agent-tui',
                },
                participants: [],
                agentRuntimeSync: null,
                agentRuntimeSyncLabel: null,
                scope: null,
                searchText: '',
                sessionCount: 1,
                source: { kind: 'internal', label: 'System' },
                systemPrompt: null,
                tabAppearance: { color: null },
                targetParticipant: null,
                title: 'System session',
                type: 'agent-engine',
            }}
        />
    );

    assert.match(markup, /System session/);
    assert.equal(markup.includes('>System</span>'), false);
    assert.equal(markup.includes('data-slot="badge">System'), false);
});
