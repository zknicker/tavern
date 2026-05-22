import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { DashboardAvatarDirectory } from '../../hooks/agents/use-agent-avatar-directory.ts';
import { ChatCardHeader } from './chat-card-header.tsx';

const stubAvatarDirectory: DashboardAvatarDirectory = {
    get(nameOrId) {
        const name = nameOrId?.trim() || 'unknown';
        return {
            avatar: name.slice(0, 2).toUpperCase(),
            backgroundColor: '#64748b',
            displayName: null,
        };
    },
};

test('ChatCardHeader renders participant avatars and omits session link blocks', () => {
    const sessionKey = 'portal:chat:atlas:c8b38c6e';
    const markup = renderToStaticMarkup(
        <ChatCardHeader
            avatarDirectory={stubAvatarDirectory}
            chat={{
                boundAgentIds: [],
                canSend: false,
                conversationKind: 'channel',
                displayName: 'general',
                framework: 'discord',
                hasActivity: true,
                id: 'chat-1',
                isDisabled: false,
                isEnabled: true,
                lastActivityAt: '2026-03-31T14:57:00.000Z',
                lastActivityLabel: '1d ago',
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
                        profileId: 'profile:self',
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
            avatarDirectory={stubAvatarDirectory}
            chat={{
                boundAgentIds: ['runtime:blippy'],
                canSend: true,
                conversationKind: 'direct',
                displayName: 'zknicker user id:778786269458464829',
                framework: 'agentRuntime',
                hasActivity: true,
                id: 'runtime:discord:agent:blippy:dm:user:778786269458464829',
                isDisabled: false,
                isEnabled: true,
                lastActivityAt: '2026-05-02T20:48:22.769Z',
                lastActivityLabel: 'now',
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
                targetParticipant: {
                    avatar: 'ZK',
                    id: 'participant:discord:global:external:778786269458464829',
                    name: 'Zach',
                    observedName: 'Zach Knickerbocker',
                    primaryColor: null,
                    profileId: 'profile:self',
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
            avatarDirectory={stubAvatarDirectory}
            chat={{
                boundAgentIds: ['blippy'],
                canSend: true,
                conversationKind: 'direct',
                displayName: 'Hey Blippy!',
                framework: 'agentRuntime',
                hasActivity: false,
                id: '220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                isDisabled: false,
                isEnabled: true,
                lastActivityAt: null,
                lastActivityLabel: 'no activity yet',
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
            avatarDirectory={stubAvatarDirectory}
            chat={{
                boundAgentIds: ['main'],
                canSend: false,
                conversationKind: 'channel',
                displayName: 'System session',
                framework: 'agentRuntime',
                hasActivity: true,
                id: 'runtime:openclaw:internal:agent:main:main',
                isDisabled: true,
                isEnabled: false,
                lastActivityAt: '2026-05-08T18:10:15.508Z',
                lastActivityLabel: 'now',
                latestSession: {
                    agentId: 'main',
                    sessionId: null,
                    lastActivityAt: '2026-05-08T18:10:15.508Z',
                    platform: 'webchat',
                    sessionKey: 'agent:main:main',
                    title: 'openclaw-tui',
                },
                participants: [],
                agentRuntimeSync: null,
                agentRuntimeSyncLabel: null,
                scope: null,
                searchText: '',
                sessionCount: 1,
                source: { kind: 'internal', label: 'System' },
                targetParticipant: null,
                title: 'System session',
                type: 'openclaw',
            }}
        />
    );

    assert.match(markup, /System session/);
    assert.equal(markup.includes('>System</span>'), false);
    assert.equal(markup.includes('data-slot="badge">System'), false);
});
