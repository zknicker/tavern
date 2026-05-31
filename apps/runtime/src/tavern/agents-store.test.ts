import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, getDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import { replaceStoredAgents } from './agents-store.ts';
import {
    replaceStoredOpenClawSessionGraphs,
    replaceStoredOpenClawSessionMessages,
    replaceStoredOpenClawSessions,
} from './openclaw-sessions-store.ts';
import {
    replaceStoredOpenClawChats,
    replaceStoredOpenClawModels,
    replaceStoredOpenClawSkills,
} from './openclaw-snapshots-store.ts';
import { handleTavernRuntimeRequest } from './router.ts';

describe('Runtime agent store', () => {
    beforeEach(() => {
        ensureRuntimeSchema(initTestDb());
    });

    afterEach(() => {
        closeDb();
    });

    it('serves agent list reads from Runtime storage', async () => {
        replaceStoredAgents({
            agents: [
                {
                    avatar: null,
                    enabledSkillIds: ['browser'],
                    emoji: null,
                    id: 'main',
                    isAdmin: false,
                    name: 'main',
                    primaryColor: null,
                    workspaceFolder: '/tmp/main',
                },
            ],
            syncedAt: '2026-05-26T20:00:00.000Z',
        });

        const response = await handleTavernRuntimeRequest(
            new Request('http://runtime.test/agents')
        );

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({
            agents: [
                {
                    avatar: null,
                    enabledSkillIds: ['browser'],
                    emoji: null,
                    id: 'main',
                    isAdmin: false,
                    name: 'main',
                    primaryColor: null,
                    workspaceFolder: '/tmp/main',
                },
            ],
        });
    });

    it('serves OpenClaw chat list reads from Runtime storage', async () => {
        replaceStoredOpenClawChats({
            chats: [
                {
                    bindingId: null,
                    bindings: [{ agentId: 'main' }],
                    id: 'runtime-chat-1',
                    inboundMode: 'active',
                    metadata: {},
                    parentTarget: null,
                    participants: [{ agentId: 'main', type: 'agent' }],
                    platform: 'tavern',
                    platformMetadata: null,
                    requiresTrigger: false,
                    scope: 'channel',
                    target: null,
                    trigger: null,
                },
            ],
            syncedAt: '2026-05-26T20:00:00.000Z',
        });

        const response = await handleTavernRuntimeRequest(
            new Request('http://runtime.test/openclaw/chats')
        );

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            chats: [{ id: 'runtime-chat-1' }],
        });
    });

    it('serves OpenClaw session evidence reads from Runtime storage', async () => {
        const session = {
            agentId: 'main',
            chatId: 'chat-1',
            key: 'agent:main:tavern:channel:chat-1',
            lastActivityAt: '2026-05-26T20:01:00.000Z',
            messageCount: 1,
            parentSessionKey: null,
            platform: 'tavern',
            sessionId: 'session-1',
            sessionRole: 'main' as const,
            startedAt: '2026-05-26T20:00:00.000Z',
            title: 'Chat 1',
        };
        const message = {
            agentId: 'main',
            chatId: 'chat-1',
            content: 'Ready.',
            id: 'message-1',
            metadata: null,
            sender: 'main',
            senderName: 'Main',
            senderType: 'agent' as const,
            sessionKey: session.key,
            timestamp: '2026-05-26T20:01:00.000Z',
        };

        replaceStoredOpenClawSessions({
            sessions: [session],
            syncedAt: '2026-05-26T20:02:00.000Z',
        });
        replaceStoredOpenClawSessionMessages({
            messagesBySessionKey: new Map([[session.key, [message]]]),
            syncedAt: '2026-05-26T20:02:00.000Z',
        });
        replaceStoredOpenClawSessionGraphs({
            graphs: [
                {
                    artifacts: [],
                    links: [],
                    messages: [message],
                    rootSessionKey: session.key,
                    sessions: [session],
                    toolCalls: [],
                },
            ],
            syncedAt: '2026-05-26T20:02:00.000Z',
        });

        const listResponse = await handleTavernRuntimeRequest(
            new Request('http://runtime.test/openclaw/sessions')
        );
        const messagesResponse = await handleTavernRuntimeRequest(
            new Request(`http://runtime.test/openclaw/sessions/${session.key}/messages`)
        );
        const graphResponse = await handleTavernRuntimeRequest(
            new Request(`http://runtime.test/openclaw/sessions/${session.key}/graph`)
        );
        const resyncResponse = await handleTavernRuntimeRequest(
            new Request(`http://runtime.test/openclaw/sessions/${session.key}/resync`, {
                method: 'POST',
            })
        );

        expect(listResponse.status).toBe(200);
        await expect(listResponse.json()).resolves.toMatchObject({
            sessions: [{ key: session.key }],
        });
        expect(messagesResponse.status).toBe(200);
        await expect(messagesResponse.json()).resolves.toMatchObject({
            messages: [{ id: 'message-1' }],
        });
        expect(graphResponse.status).toBe(200);
        await expect(graphResponse.json()).resolves.toMatchObject({
            messages: [{ id: 'message-1' }],
            rootSessionKey: session.key,
        });
        expect(resyncResponse.status).toBe(200);
        await expect(resyncResponse.json()).resolves.toEqual({
            resynced: true,
            rootSessionKey: session.key,
            sessionKey: session.key,
        });
    });

    it('stores duplicate OpenClaw message ids under separate session keys', async () => {
        const firstSession = {
            agentId: 'main',
            chatId: 'chat-1',
            key: 'agent:main:tavern:channel:chat-1',
            lastActivityAt: '2026-05-26T20:01:00.000Z',
            messageCount: 1,
            parentSessionKey: null,
            platform: 'tavern',
            sessionId: 'session-1',
            sessionRole: 'main' as const,
            startedAt: '2026-05-26T20:00:00.000Z',
            title: 'Chat 1',
        };
        const secondSession = {
            ...firstSession,
            chatId: 'chat-2',
            key: 'agent:main:tavern:channel:chat-2',
            sessionId: 'session-2',
            title: 'Chat 2',
        };
        const message = {
            agentId: 'main',
            chatId: 'chat-1',
            content: 'Ready.',
            id: 'message-1',
            metadata: null,
            sender: 'main',
            senderName: 'Main',
            senderType: 'agent' as const,
            sessionKey: firstSession.key,
            timestamp: '2026-05-26T20:01:00.000Z',
        };

        replaceStoredOpenClawSessions({
            sessions: [firstSession, secondSession],
            syncedAt: '2026-05-26T20:02:00.000Z',
        });
        replaceStoredOpenClawSessionMessages({
            messagesBySessionKey: new Map([
                [firstSession.key, [message]],
                [
                    secondSession.key,
                    [
                        {
                            ...message,
                            chatId: secondSession.chatId,
                            sessionKey: secondSession.key,
                        },
                    ],
                ],
            ]),
            syncedAt: '2026-05-26T20:02:00.000Z',
        });

        const firstResponse = await handleTavernRuntimeRequest(
            new Request(`http://runtime.test/openclaw/sessions/${firstSession.key}/messages`)
        );
        const secondResponse = await handleTavernRuntimeRequest(
            new Request(`http://runtime.test/openclaw/sessions/${secondSession.key}/messages`)
        );

        expect(firstResponse.status).toBe(200);
        await expect(firstResponse.json()).resolves.toMatchObject({
            messages: [{ id: 'message-1', sessionKey: firstSession.key }],
        });
        expect(secondResponse.status).toBe(200);
        await expect(secondResponse.json()).resolves.toMatchObject({
            messages: [{ id: 'message-1', sessionKey: secondSession.key }],
        });
    });

    it('can update one OpenClaw session without pruning the snapshot', async () => {
        const firstSession = {
            agentId: 'main',
            chatId: 'chat-1',
            key: 'agent:main:tavern:channel:chat-1',
            lastActivityAt: '2026-05-26T20:01:00.000Z',
            messageCount: 1,
            parentSessionKey: null,
            platform: 'tavern',
            sessionId: 'session-1',
            sessionRole: 'main' as const,
            startedAt: '2026-05-26T20:00:00.000Z',
            title: 'Chat 1',
        };
        const secondSession = {
            ...firstSession,
            chatId: 'chat-2',
            key: 'agent:main:tavern:channel:chat-2',
            sessionId: 'session-2',
            title: 'Chat 2',
        };

        replaceStoredOpenClawSessions({
            sessions: [firstSession, secondSession],
            syncedAt: '2026-05-26T20:02:00.000Z',
        });
        replaceStoredOpenClawSessions({
            pruneMissing: false,
            sessions: [{ ...firstSession, messageCount: 2 }],
            syncedAt: '2026-05-26T20:03:00.000Z',
        });

        const response = await handleTavernRuntimeRequest(
            new Request('http://runtime.test/openclaw/sessions')
        );

        expect(response.status).toBe(200);
        const body = (await response.json()) as {
            sessions: Array<{ key: string; messageCount: number }>;
        };
        expect(body.sessions).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ key: firstSession.key, messageCount: 2 }),
                expect.objectContaining({ key: secondSession.key, messageCount: 1 }),
            ])
        );
    });

    it('serves model reads from Runtime storage', async () => {
        replaceStoredOpenClawModels({
            models: {
                models: [{ id: 'openai/gpt-5.5', label: 'GPT-5.5', provider: 'openai' }],
                updatedAt: '2026-05-26T20:00:00.000Z',
            },
            syncedAt: '2026-05-26T20:00:00.000Z',
        });

        const response = await handleTavernRuntimeRequest(
            new Request('http://runtime.test/models')
        );

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            models: [{ id: 'openai/gpt-5.5', label: 'GPT-5.5', provider: 'openai' }],
        });
    });

    it('invalidates stale OpenClaw model snapshots with the old shape', async () => {
        const timestamp = '2026-05-26T20:00:00.000Z';
        const db = getDb();
        db.prepare(
            `INSERT INTO openclaw_models_snapshot (
                id,
                raw_json,
                last_synced_at,
                created_at,
                updated_at
            )
            VALUES ('default', ?, ?, ?, ?)`
        ).run(
            JSON.stringify({
                agents: [],
                configuredModels: [],
                defaults: { fallbackModels: [], primaryModel: null },
                updatedAt: timestamp,
            }),
            timestamp,
            timestamp,
            timestamp
        );

        const response = await handleTavernRuntimeRequest(
            new Request('http://runtime.test/models')
        );

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({
            models: [],
            updatedAt: null,
        });
        expect(
            db.prepare("SELECT id FROM openclaw_models_snapshot WHERE id = 'default'").get()
        ).toBeNull();
    });

    it('serves skill list and detail reads from Runtime storage', async () => {
        const skill = {
            allowedTools: null,
            configChecks: [],
            contentMarkdown: 'Use the browser.',
            description: 'Browser skill',
            files: [],
            id: 'browser',
            install: [],
            installSource: null,
            missing: { anyBins: [], bins: [], config: [], env: [], os: [] },
            name: 'Browser',
            requirements: { anyBins: [], bins: [], config: [], env: [], os: [] },
            source: 'builtin' as const,
            updatedAt: '2026-05-26T20:00:00.000Z',
        };
        replaceStoredOpenClawSkills({
            skillDetails: [skill],
            skills: [skill],
            syncedAt: '2026-05-26T20:00:00.000Z',
        });

        const listResponse = await handleTavernRuntimeRequest(
            new Request('http://runtime.test/skills')
        );
        const detailResponse = await handleTavernRuntimeRequest(
            new Request('http://runtime.test/skills/browser/config')
        );

        expect(listResponse.status).toBe(200);
        await expect(listResponse.json()).resolves.toMatchObject({
            skills: expect.arrayContaining([expect.objectContaining({ id: 'browser' })]),
        });
        expect(detailResponse.status).toBe(200);
        await expect(detailResponse.json()).resolves.toMatchObject({
            contentMarkdown: 'Use the browser.',
            id: 'browser',
        });
    });

    it('serves summary-only skills as empty detail records', async () => {
        const skill = {
            allowedTools: null,
            configChecks: [],
            description: 'Browser skill',
            id: 'browser',
            install: [],
            missing: { anyBins: [], bins: [], config: [], env: [], os: [] },
            name: 'Browser',
            requirements: { anyBins: [], bins: [], config: [], env: [], os: [] },
            source: 'builtin' as const,
            updatedAt: '2026-05-26T20:00:00.000Z',
        };
        replaceStoredOpenClawSkills({
            skills: [skill],
            syncedAt: '2026-05-26T20:00:00.000Z',
        });

        const response = await handleTavernRuntimeRequest(
            new Request('http://runtime.test/skills/browser/config')
        );

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            contentMarkdown: '',
            id: 'browser',
        });
    });
});
