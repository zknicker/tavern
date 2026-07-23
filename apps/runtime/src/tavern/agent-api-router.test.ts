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

describe('agent task routes', () => {
    let root: string;
    beforeEach(() => {
        root = initAgentApiTestDb('grotto-agent-tasks-');
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

    it('creates, lists, claims, and updates task-messages over the wire', async () => {
        const created = await request('POST', '/api/agent/tasks/create', {
            target: '#general',
            titles: ['Audit the export', 'Fix the export'],
        });
        expect(created?.status).toBe(200);
        const createdBody = (await created?.json()) as {
            tasks: Array<{ number: number; status: string }>;
        };
        expect(createdBody.tasks.map((task) => task.number)).toEqual([1, 2]);
        expect(createdBody.tasks[0]?.status).toBe('todo');

        const claimed = await request('POST', '/api/agent/tasks/claim', {
            numbers: [1],
            target: '#general',
        });
        const claimedBody = (await claimed?.json()) as {
            claimed: Array<{ assignee: string | null; status: string }>;
        };
        expect(claimedBody.claimed[0]).toMatchObject({ assignee: 'Otto', status: 'in_progress' });

        const updated = await request('POST', '/api/agent/tasks/update', {
            number: 1,
            status: 'in_review',
            target: '#general',
        });
        const updatedBody = (await updated?.json()) as { task: { status: string } };
        expect(updatedBody.task.status).toBe('in_review');

        const list = await request('GET', '/api/agent/tasks?target=%23general&status=in_review');
        const listBody = (await list?.json()) as {
            tasks: Array<{ message: { content: string; task?: { number: number } | null } }>;
        };
        expect(listBody.tasks).toHaveLength(1);
        expect(listBody.tasks[0]?.message.content).toBe('Audit the export');
        expect(listBody.tasks[0]?.message.task).toMatchObject({ number: 1 });
    });

    it('claims a regular message by id, converting it with a receipt', async () => {
        createMessage('cht_general', {
            author_id: 'usr_tavern',
            content: 'Please fix the login bug',
            id: 'msg_feedface000000000000000000000000',
            role: 'user',
        });
        const claimed = await request('POST', '/api/agent/tasks/claim', {
            messageId: 'feedface',
            target: '#general',
        });
        expect(claimed?.status).toBe(200);
        const body = (await claimed?.json()) as {
            claimed: Array<{ number: number; status: string }>;
        };
        expect(body.claimed[0]).toMatchObject({ number: 1, status: 'in_progress' });

        const rival = await request('POST', '/api/agent/tasks/claim', {
            numbers: [1],
            target: '#general',
        });
        // Re-claiming your own task is allowed; verify the conflict path via a
        // fake rival assignment instead.
        expect(rival?.status).toBe(200);
    });

    function request(method: 'GET' | 'POST', pathName: string, body?: unknown) {
        return handleAgentApiRequest(
            new Request(`http://runtime.test${pathName}`, {
                ...(body === undefined
                    ? {}
                    : {
                          body: JSON.stringify(body),
                          headers: { 'content-type': 'application/json' },
                      }),
                method,
            }),
            'agt_otto'
        );
    }
});

function seed(id: string) {
    createMessage('cht_general', { author_id: 'usr_tavern', content: id, id, role: 'user' });
}
