import { describe, expect, it } from 'bun:test';
import { mapOpenClawSessionList as mapOpenClawSessionListRaw } from './list.ts';

function mapOpenClawSessionList(input: { sessions: Record<string, unknown>[] }) {
    return mapOpenClawSessionListRaw({
        sessions: input.sessions.map((session, index) => ({
            sessionId: `session-${index}`,
            ...session,
        })),
    });
}

describe('OpenClaw session mapping', () => {
    it('derives agent and Discord metadata from session keys', () => {
        const mapped = mapOpenClawSessionList({
            sessions: withSessionIds([
                {
                    key: 'agent:main:discord:channel:1090835947375054891',
                    lastActivityAt: '2026-05-02T03:29:16.321Z',
                    lastChannel: 'discord',
                    lastTo: 'channel:1090835947375054891',
                    subject: '#general',
                },
            ]),
        });

        expect(mapped.sessions[0]).toMatchObject({
            agentId: 'main',
            chatId: 'discord:channel:1090835947375054891',
            key: 'agent:main:discord:channel:1090835947375054891',
            platform: 'discord',
            title: '#general',
        });
    });

    it('derives Discord DM metadata from OpenClaw direct session keys', () => {
        const mapped = mapOpenClawSessionList({
            sessions: withSessionIds([
                {
                    displayName: 'Main DM',
                    key: 'agent:main:discord:direct:778399409263837194',
                    lastActivityAt: '2026-05-02T03:29:16.321Z',
                },
            ]),
        });

        expect(mapped.sessions[0]).toMatchObject({
            agentId: 'main',
            chatId: 'discord:agent:main:dm:778399409263837194',
            platform: 'discord',
            title: 'Main DM',
        });
    });

    it('keeps webchat-originated Tavern sessions on the Tavern chat id', () => {
        const mapped = mapOpenClawSessionList({
            sessions: [
                {
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

        expect(mapped.sessions[0]).toMatchObject({
            agentId: 'main',
            chatId: 'cht_220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
            platform: 'tavern',
        });
    });

    it('uses OpenClaw delivery fields for shared main-session Discord DMs', () => {
        const mapped = mapOpenClawSessionList({
            sessions: withSessionIds([
                {
                    displayName: 'Blippy DM',
                    key: 'agent:blippy:main',
                    kind: 'direct',
                    lastChannel: 'discord',
                    lastTo: 'user:778399409263837194',
                },
            ]),
        });

        expect(mapped.sessions[0]).toMatchObject({
            agentId: 'blippy',
            chatId: 'discord:agent:blippy:dm:user:778399409263837194',
            platform: 'discord',
            title: 'Blippy DM',
        });
    });

    it('keeps internal sessions explicit when no platform conversation exists', () => {
        const mapped = mapOpenClawSessionList({
            sessions: withSessionIds([
                {
                    key: 'agent:main:cron:8300bbe8-7fb6-4ffb-aa7e-7f19005775c6',
                    title: 'Cron: daily-morning-briefing',
                },
            ]),
        });

        expect(mapped.sessions[0]).toMatchObject({
            agentId: 'main',
            chatId: 'openclaw:internal:agent:main:cron:8300bbe8-7fb6-4ffb-aa7e-7f19005775c6',
            platform: 'cron',
            title: 'Cron: daily-morning-briefing',
        });
    });

    it('keeps unlabeled internal sessions syncable', () => {
        const mapped = mapOpenClawSessionList({
            sessions: withSessionIds([
                {
                    key: 'agent:codex:acp:001d4d8a-e84b-480e-a459-d3764a170737',
                    updatedAt: 1_777_831_592_669,
                },
            ]),
        });

        expect(mapped.sessions[0]).toMatchObject({
            agentId: 'codex',
            chatId: 'openclaw:internal:agent:codex:acp:001d4d8a-e84b-480e-a459-d3764a170737',
            platform: 'acp',
            title: null,
        });
    });

    it('uses the parent chat for spawned OpenClaw subagent sessions', () => {
        const mapped = mapOpenClawSessionList({
            sessions: withSessionIds([
                {
                    displayName: 'discord:1090835947375054888#general',
                    key: 'agent:main:subagent:62d63671-c8d7-482b-a36f-1928780bfacf',
                    spawnedBy: 'agent:main:discord:channel:1090835947375054891',
                },
            ]),
        });

        expect(mapped.sessions[0]).toMatchObject({
            agentId: 'main',
            chatId: 'discord:channel:1090835947375054891',
            platform: 'discord',
            title: 'discord:1090835947375054888#general',
        });
    });
});

function withSessionIds<T extends { key: string }>(sessions: T[]) {
    return sessions.map((session) => ({
        sessionId: session.key,
        ...session,
    }));
}
