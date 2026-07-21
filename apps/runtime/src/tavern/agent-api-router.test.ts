import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getDb } from '../db/connection.ts';
import { handleAgentApiRequest } from './agent-api-router.ts';
import { closeAgentApiTestDb, initAgentApiTestDb } from './agent-api-test-helper.ts';
import { saveAgentDraft } from './agent-drafts.ts';
import { upsertStoredAgent } from './agents-store.ts';
import { createChat, createMessage } from './chat-api/index.ts';

describe('agent API router', () => {
    let root: string;
    beforeEach(() => {
        root = initAgentApiTestDb('grotto-agent-router-');
        upsertStoredAgent({
            agent: {
                enabledSkillIds: [],
                id: 'agt_otto',
                isAdmin: false,
                name: 'Otto',
                primaryColor: null,
                workspaceFolder: '/tmp/agt_otto',
            },
        });
        createChat({
            id: 'cht_general',
            kind: 'channel',
            participants: [
                {
                    id: 'agt_otto',
                    kind: 'agent',
                    label: 'Otto',
                    metadata: { agentId: 'agt_otto' },
                },
            ],
            title: 'general',
        });
    });
    afterEach(async () => await closeAgentApiTestDb(root));

    it('returns the stable ambiguity error body', async () => {
        seed('msg_deadbeef000000000000000000000000');
        seed('msg_deadbeefffffffffffffffffffffffff');
        const response = await handleAgentApiRequest(
            new Request('http://runtime.test/api/agent/messages/deadbeef'),
            'agt_otto'
        );
        expect(response?.status).toBe(409);
        await expect(response?.json()).resolves.toEqual({
            code: 'AMBIGUOUS_ID',
            message: 'Short message id is ambiguous. Use the full message id.',
            nextAction: 'Use the full message id.',
        });
    });

    it('serves directory and idempotent send routes', async () => {
        const directory = await handleAgentApiRequest(
            new Request('http://runtime.test/api/agent/server?channels=true&joined=true'),
            'agt_otto'
        );
        await expect(directory?.json()).resolves.toMatchObject({
            channels: [{ handle: 'general', joined: true }],
            hasMore: { channels: false },
            total: { channels: 1 },
        });

        const body = JSON.stringify({ content: 'once', nonce: 'nonce-1', target: '#general' });
        const first = await handleAgentApiRequest(
            new Request('http://runtime.test/api/agent/messages/send', {
                body,
                headers: { 'content-type': 'application/json' },
                method: 'POST',
            }),
            'agt_otto'
        );
        const second = await handleAgentApiRequest(
            new Request('http://runtime.test/api/agent/messages/send', {
                body,
                headers: { 'content-type': 'application/json' },
                method: 'POST',
            }),
            'agt_otto'
        );
        const firstJson = (await first?.json()) as { message: { id: string }; state: string };
        const secondJson = (await second?.json()) as { message: { id: string }; state: string };
        expect(firstJson.state).toBe('sent');
        expect(secondJson.message.id).toBe(firstJson.message.id);
    });

    it('reports directory totals and more rows before pagination', async () => {
        createChat({
            id: 'cht_updates',
            kind: 'channel',
            participants: [
                {
                    id: 'agt_otto',
                    kind: 'agent',
                    label: 'Otto',
                    metadata: { agentId: 'agt_otto' },
                },
            ],
            title: 'updates',
        });
        const response = await handleAgentApiRequest(
            new Request('http://runtime.test/api/agent/server?channels=true&limit=1'),
            'agt_otto'
        );

        await expect(response?.json()).resolves.toMatchObject({
            channels: [{ handle: 'general' }],
            hasMore: { channels: true },
            limit: 1,
            offset: 0,
            total: { channels: 2 },
        });
    });

    it('adds draftSaved only after the send target resolves', async () => {
        const missingDraft = await send({ sendDraft: true, target: '#general' });
        await expect(missingDraft?.json()).resolves.toMatchObject({
            code: 'SEND_DRAFT_NOT_FOUND',
            draftSaved: false,
        });

        const missingTarget = await send({ content: 'hello', target: '#missing' });
        const missingTargetBody = (await missingTarget?.json()) as Record<string, unknown>;
        expect(missingTargetBody).not.toHaveProperty('draftSaved');

        saveAgentDraft({
            agentId: 'agt_otto',
            attachmentIds: [],
            chatId: 'cht_general',
            content: 'keep me',
            reholdCount: 1,
        });
        const db = getDb();
        db.exec('PRAGMA foreign_keys = OFF');
        db.prepare("DELETE FROM agents WHERE id = 'agt_otto'").run();
        const savedDraft = await send({ content: 'replacement', target: '#general' });
        await expect(savedDraft?.json()).resolves.toMatchObject({
            code: 'SEND_FAILED',
            draftSaved: true,
        });
    });

    function send(body: Record<string, unknown>) {
        return handleAgentApiRequest(
            new Request('http://runtime.test/api/agent/messages/send', {
                body: JSON.stringify(body),
                headers: { 'content-type': 'application/json' },
                method: 'POST',
            }),
            'agt_otto'
        );
    }
});

function seed(id: string) {
    createMessage('cht_general', { author_id: 'usr_tavern', content: id, id, role: 'user' });
}
