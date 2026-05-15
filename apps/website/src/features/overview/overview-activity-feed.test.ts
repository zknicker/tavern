import { expect, test } from 'vitest';
import { buildOverviewActivityItems } from './overview-activity-feed.tsx';

test('buildOverviewActivityItems uses current chat fields without requiring latestSession.channel', () => {
    const items = buildOverviewActivityItems({
        agents: [
            {
                avatar: 'A',
                defaultPrimaryColor: '#64748b',
                effectivePrimaryColor: '#64748b',
                enabledSkillIds: [],
                id: 'atlas',
                name: 'Atlas',
                primaryColor: null,
                runtimeId: 'tavern-openclaw-managed',
                title: 'Atlas',
                updatedAt: '2026-04-17T19:00:00.000Z',
                usesAllSkills: false,
            },
        ],
        chats: [
            {
                boundAgentIds: ['atlas'],
                canSend: true,
                conversationKind: 'group',
                displayName: 'portal:chat',
                externalId: null,
                framework: 'tavern',
                id: 'tavern:chat-1',
                isEnabled: true,
                lastActivityAt: '2026-04-17T19:00:00.000Z',
                latestSession: {
                    agentId: 'atlas',
                    lastActivityAt: '2026-04-17T19:00:00.000Z',
                    platform: 'tavern',
                    sessionId: null,
                    sessionKey: 'session:1',
                    title: 'portal:chat',
                },
                participants: [],
                agentRuntimeSync: null,
                platformMetadata: null,
                scope: null,
                sessionCount: 1,
                source: { kind: 'tavern', label: 'Tavern' },
                target: null,
                targetParticipant: null,
                title: 'portal:chat',
                type: 'tavern',
            },
        ],
        recentCronJobs: [],
        workers: [],
    });

    expect(items).toEqual([
        expect.objectContaining({
            headline: 'Atlas chatted in portal:chat',
            id: 'chat:session:1',
            sessionKey: 'session:1',
        }),
    ]);
});
