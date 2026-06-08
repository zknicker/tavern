import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HERMES_WORKSPACE } from '../config.ts';
import { closeDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import { handleTavernRuntimeRequest } from './router.ts';

describe('Runtime agent and Hermes reads', () => {
    const originalFetch = globalThis.fetch;

    beforeEach(() => {
        ensureRuntimeSchema(initTestDb());
        globalThis.fetch = vi.fn(handleHermesFetch) as unknown as typeof fetch;
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
        closeDb();
    });

    it('serves Hermes agent list reads through the runtime adapter', async () => {
        const response = await handleTavernRuntimeRequest(
            new Request('http://runtime.test/agents')
        );

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({
            agents: [
                {
                    avatar: null,
                    enabledSkillIds: [],
                    emoji: null,
                    hermesModelName: {
                        harness: 'codex',
                        model: 'gpt-5.5',
                        provider: 'openai-codex',
                    },
                    id: 'agt_hermes',
                    isAdmin: true,
                    name: 'Hermes',
                    primaryColor: null,
                    workspaceFolder: HERMES_WORKSPACE,
                },
            ],
        });
    });

    it('serves Hermes sessions and evidence through the runtime adapter', async () => {
        const sessionKey = 'session_1';

        const listResponse = await handleTavernRuntimeRequest(
            new Request('http://runtime.test/hermes/sessions')
        );
        const messagesResponse = await handleTavernRuntimeRequest(
            new Request(`http://runtime.test/hermes/sessions/${sessionKey}/messages`)
        );
        const graphResponse = await handleTavernRuntimeRequest(
            new Request(`http://runtime.test/hermes/sessions/${sessionKey}/graph`)
        );
        const resyncResponse = await handleTavernRuntimeRequest(
            new Request(`http://runtime.test/hermes/sessions/${sessionKey}/resync`, {
                method: 'POST',
            })
        );

        expect(listResponse.status).toBe(200);
        await expect(listResponse.json()).resolves.toMatchObject({
            sessions: [{ key: sessionKey, platform: 'hermes' }],
        });
        expect(messagesResponse.status).toBe(200);
        await expect(messagesResponse.json()).resolves.toMatchObject({
            messages: [{ content: 'Ready.', id: `${sessionKey}:0`, sessionKey }],
        });
        expect(graphResponse.status).toBe(200);
        await expect(graphResponse.json()).resolves.toMatchObject({
            messages: [{ content: 'Ready.' }],
            rootSessionKey: sessionKey,
        });
        expect(resyncResponse.status).toBe(200);
        await expect(resyncResponse.json()).resolves.toEqual({
            resynced: true,
            rootSessionKey: sessionKey,
            sessionKey,
        });
    });

    it('serves Hermes model reads through the runtime adapter', async () => {
        const response = await handleTavernRuntimeRequest(
            new Request('http://runtime.test/models')
        );

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            models: [{ id: 'openai-codex/gpt-5.5', label: 'gpt-5.5', provider: 'openai-codex' }],
        });
    });

    it('applies Hermes model updates through the dashboard model API', async () => {
        const response = await handleTavernRuntimeRequest(
            new Request('http://runtime.test/agents/agt_hermes/model', {
                body: JSON.stringify({
                    model: {
                        harness: 'codex',
                        model: 'gpt-5.5',
                        provider: 'openai-codex',
                    },
                }),
                headers: { 'content-type': 'application/json' },
                method: 'PATCH',
            })
        );

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            config: {
                model: {
                    default: 'gpt-5.5',
                    provider: 'openai-codex',
                },
            },
            valid: true,
        });
    });

    it('serves Hermes skill list and detail reads through the runtime adapter', async () => {
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
            contentMarkdown: '',
            id: 'browser',
        });
    });
});

function handleHermesFetch(input: string | URL | Request) {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);

    if (url.pathname === '/api/sessions') {
        return jsonResponse({
            data: [
                {
                    id: 'session_1',
                    last_active: 1_779_828_060,
                    message_count: 1,
                    preview: 'Ready.',
                    source: 'api_server',
                    started_at: 1_779_828_000,
                    title: 'Chat 1',
                },
            ],
            object: 'list',
        });
    }

    if (url.pathname === '/api/sessions/session_1/messages') {
        return jsonResponse({
            data: [
                {
                    content: 'Ready.',
                    role: 'assistant',
                    timestamp: 1_779_828_060,
                },
            ],
            object: 'list',
            session_id: 'session_1',
        });
    }

    if (url.pathname === '/api/model/options') {
        return jsonResponse({
            providers: [
                {
                    models: ['gpt-5.5'],
                    name: 'OpenAI Codex',
                    slug: 'openai-codex',
                },
            ],
        });
    }

    if (url.pathname === '/api/model/set') {
        return jsonResponse({ ok: true, model: 'gpt-5.5', provider: 'openai-codex' });
    }

    if (url.pathname === '/api/skills') {
        return jsonResponse({
            skills: [
                {
                    description: 'Browser skill',
                    enabled: true,
                    id: 'browser',
                    name: 'Browser',
                },
            ],
        });
    }

    return jsonResponse({ error: 'not found' }, { status: 404 });
}

function jsonResponse(body: unknown, init?: ResponseInit) {
    return Promise.resolve(
        new Response(JSON.stringify(body), {
            headers: { 'content-type': 'application/json' },
            status: init?.status ?? 200,
        })
    );
}
