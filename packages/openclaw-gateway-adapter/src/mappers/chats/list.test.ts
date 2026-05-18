import { describe, expect, it } from 'bun:test';
import { mapOpenClawChatsFromSessions as mapOpenClawChatsFromSessionsRaw } from './list.ts';

function mapOpenClawChatsFromSessions(input: { sessions: Record<string, unknown>[] }) {
    return mapOpenClawChatsFromSessionsRaw({
        sessions: input.sessions.map((session, index) => ({
            sessionId: `session-${index}`,
            ...session,
        })),
    });
}

describe('OpenClaw chat mapping', () => {
    it('does not project Tavern app chats from OpenClaw sessions', () => {
        const mapped = mapOpenClawChatsFromSessions({
            sessions: withSessionIds([
                {
                    agentId: 'main',
                    displayName: 'Planning room',
                    key: 'agent:main:tavern:channel:cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                    metadata: {
                        tavern: {
                            chatId: 'cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                            conversationId: 'conversation:1',
                            displayName: 'Planning room',
                        },
                    },
                    platform: 'tavern',
                    runId: 'run-1',
                },
                {
                    agentId: 'tiny',
                    key: 'agent:tiny:tavern:channel:cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                    metadata: {
                        tavern: {
                            chatId: 'cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                            conversationId: 'conversation:1',
                        },
                    },
                    platform: 'tavern',
                },
            ]),
        });

        expect(mapped.chats).toEqual([]);
    });

    it('does not create Tavern app chats from session keys when metadata is absent', () => {
        const mapped = mapOpenClawChatsFromSessions({
            sessions: withSessionIds([
                {
                    agentId: 'blippy',
                    key: 'agent:blippy:tavern:channel:cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                    title: 'Blippy Tavern chat',
                },
            ]),
        });

        expect(mapped.chats).toEqual([]);
    });

    it('does not create Tavern app chats from webchat-originated Tavern sessions', () => {
        const mapped = mapOpenClawChatsFromSessions({
            sessions: [
                {
                    agentId: 'main',
                    deliveryContext: {
                        channel: 'tavern',
                    },
                    key: 'agent:main:tavern:channel:cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                    origin: {
                        provider: 'webchat',
                        surface: 'webchat',
                    },
                },
            ],
        });

        expect(mapped.chats).toEqual([]);
    });

    it('rejects Tavern Messenger sessions that collapse to an OpenClaw main session key', () => {
        expect(() =>
            mapOpenClawChatsFromSessions({
                sessions: [
                    {
                        key: 'agent:blippy:main',
                        lastChannel: 'tavern',
                        origin: {
                            chatType: 'direct',
                            from: 'chat:tavern:cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                            label: 'tavern:cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                            nativeChannelId: 'tavern:cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                            provider: 'tavern',
                            surface: 'tavern',
                            to: 'chat:tavern:cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                        },
                    },
                ],
            })
        ).toThrow(/missing a stable Tavern chat id/u);
    });

    it('rejects stale namespaced Tavern Messenger chat ids', () => {
        expect(() =>
            mapOpenClawChatsFromSessions({
                sessions: [
                    {
                        key: 'agent:blippy:tavern:channel:chat:tavern:cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                        lastChannel: 'tavern',
                        origin: {
                            chatType: 'channel',
                            from: 'chat:tavern:cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                            label: 'tavern:cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                            nativeChannelId: 'tavern:cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                            provider: 'tavern',
                            surface: 'tavern',
                            to: 'chat:tavern:cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                        },
                    },
                ],
            })
        ).toThrow(/missing a stable Tavern chat id/u);
    });

    it('derives chat bindings and Discord target from session keys', () => {
        const mapped = mapOpenClawChatsFromSessions({
            sessions: withSessionIds([
                {
                    key: 'agent:main:discord:channel:1090835947375054891',
                    lastActivityAt: '2026-05-02T03:29:16.321Z',
                    subject: '#general',
                },
            ]),
        });

        expect(mapped.chats[0]).toMatchObject({
            bindings: [{ agentId: 'main' }],
            id: 'discord:channel:1090835947375054891',
            participants: [{ agentId: 'main', type: 'agent' }],
            platform: 'discord',
            scope: 'channel',
            target: 'channel:1090835947375054891',
        });
    });

    it('groups multiple agent sessions into one Discord channel chat', () => {
        const mapped = mapOpenClawChatsFromSessions({
            sessions: withSessionIds([
                {
                    chatType: 'channel',
                    displayName: 'discord:1090835947375054888#general',
                    groupChannel: '#general',
                    key: 'agent:main:discord:channel:1090835947375054891',
                    lastChannel: 'discord',
                    lastTo: 'channel:1090835947375054891',
                },
                {
                    chatType: 'channel',
                    displayName: 'discord:1090835947375054888#general',
                    groupChannel: '#general',
                    key: 'agent:tiny:discord:channel:1090835947375054891',
                    lastChannel: 'discord',
                    lastTo: 'channel:1090835947375054891',
                },
                {
                    chatType: 'channel',
                    displayName: 'discord:1090835947375054888#general',
                    groupChannel: '#general',
                    key: 'agent:flicker:discord:channel:1090835947375054891',
                    lastChannel: 'discord',
                    lastTo: 'channel:1090835947375054891',
                },
                {
                    displayName: 'discord:1090835947375054888#general',
                    groupChannel: '#general',
                    key: 'agent:main:subagent:62d63671-c8d7-482b-a36f-1928780bfacf',
                    spawnedBy: 'agent:main:discord:channel:1090835947375054891',
                },
            ]),
        });

        expect(mapped.chats).toHaveLength(1);
        expect(mapped.chats[0]).toMatchObject({
            bindings: [{ agentId: 'flicker' }, { agentId: 'main' }, { agentId: 'tiny' }],
            id: 'discord:channel:1090835947375054891',
            participants: [
                { agentId: 'flicker', type: 'agent' },
                { agentId: 'main', type: 'agent' },
                { agentId: 'tiny', type: 'agent' },
            ],
            platform: 'discord',
            platformMetadata: {
                channel: {
                    id: '1090835947375054891',
                    name: '#general',
                },
                provider: 'discord',
            },
            scope: 'channel',
            target: 'channel:1090835947375054891',
        });
        expect(mapped.chats[0]?.metadata).toEqual({
            sessionKeys: [
                'agent:flicker:discord:channel:1090835947375054891',
                'agent:main:discord:channel:1090835947375054891',
                'agent:main:subagent:62d63671-c8d7-482b-a36f-1928780bfacf',
                'agent:tiny:discord:channel:1090835947375054891',
            ],
        });
    });

    it('maps OpenClaw direct sessions to Tavern DM chats', () => {
        const mapped = mapOpenClawChatsFromSessions({
            sessions: withSessionIds([
                {
                    key: 'agent:main:discord:direct:778399409263837194',
                    lastActivityAt: '2026-05-02T03:29:16.321Z',
                    title: 'Main DM',
                },
            ]),
        });

        expect(mapped.chats[0]).toMatchObject({
            bindings: [{ agentId: 'main' }],
            id: 'discord:agent:main:dm:778399409263837194',
            participants: [
                { agentId: 'main', type: 'agent' },
                {
                    accountKey: null,
                    externalId: '778399409263837194',
                    name: 'Main DM',
                    observedLabels: ['Main DM'],
                    participantId: 'participant:discord:global:external:778399409263837194',
                    platform: 'discord',
                    type: 'participant',
                },
            ],
            platform: 'discord',
            scope: 'dm',
            target: 'dm:778399409263837194',
        });
    });

    it('keeps Discord DMs separate per OpenClaw agent', () => {
        const mapped = mapOpenClawChatsFromSessions({
            sessions: withSessionIds([
                {
                    displayName: 'Blippy DM',
                    key: 'agent:blippy:main',
                    kind: 'direct',
                    lastChannel: 'discord',
                    lastTo: 'user:778399409263837194',
                },
                {
                    displayName: 'Main DM',
                    key: 'agent:main:main',
                    kind: 'direct',
                    lastChannel: 'discord',
                    lastTo: 'user:778399409263837194',
                },
            ]),
        });

        expect(mapped.chats).toHaveLength(2);
        expect(mapped.chats[0]).toMatchObject({
            bindings: [{ agentId: 'blippy' }],
            id: 'discord:agent:blippy:dm:user:778399409263837194',
            participants: [
                { agentId: 'blippy', type: 'agent' },
                {
                    accountKey: null,
                    externalId: '778399409263837194',
                    name: 'Blippy DM',
                    observedLabels: ['Blippy DM'],
                    participantId: 'participant:discord:global:external:778399409263837194',
                    platform: 'discord',
                    type: 'participant',
                },
            ],
            platform: 'discord',
            scope: 'dm',
            target: 'dm:user:778399409263837194',
        });
        expect(mapped.chats[1]).toMatchObject({
            bindings: [{ agentId: 'main' }],
            id: 'discord:agent:main:dm:user:778399409263837194',
            participants: [
                { agentId: 'main', type: 'agent' },
                {
                    accountKey: null,
                    externalId: '778399409263837194',
                    name: 'Main DM',
                    observedLabels: ['Main DM'],
                    participantId: 'participant:discord:global:external:778399409263837194',
                    platform: 'discord',
                    type: 'participant',
                },
            ],
            platform: 'discord',
            scope: 'dm',
            target: 'dm:user:778399409263837194',
        });
    });

    it('does not infer a chat target from opaque session keys', () => {
        const mapped = mapOpenClawChatsFromSessions({
            sessions: withSessionIds([
                {
                    key: 'agent:blippy:main',
                    lastActivityAt: '2026-05-02T03:29:16.321Z',
                    title: 'Blippy internal',
                },
            ]),
        });

        expect(mapped.chats[0]).toMatchObject({
            bindings: [{ agentId: 'blippy' }],
            id: 'openclaw:internal:agent:blippy:main',
            participants: [{ agentId: 'blippy', type: 'agent' }],
            platform: 'openclaw',
            scope: null,
            target: null,
        });
    });
});

function withSessionIds<T extends { key: string }>(sessions: T[]) {
    return sessions.map((session) => ({
        sessionId: session.key,
        ...session,
    }));
}
