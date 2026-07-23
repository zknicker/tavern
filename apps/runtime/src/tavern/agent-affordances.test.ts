import fs from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getDb } from '../db/connection.ts';
import { handleAgentApiRequest } from './agent-api-router.ts';
import { closeAgentApiTestDb, initAgentApiTestDb } from './agent-api-test-helper.ts';
import { upsertStoredAgent } from './agents-store.ts';
import { createChat, createMessage } from './chat-api/index.ts';

describe('agent affordance routes', () => {
    let root: string;
    let attachmentsDir: string;
    let skillsDir: string;

    beforeEach(async () => {
        root = initAgentApiTestDb('grotto-agent-affordances-');
        attachmentsDir = path.join(root, 'attachments');
        skillsDir = path.join(root, 'skills');
        await fs.mkdir(skillsDir, { recursive: true });
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

    it('adds and removes reactions and rejects ambiguous short ids', async () => {
        seedMessage('msg_feedface000000000000000000000000');
        const added = await request('POST', '/api/agent/messages/react', {
            emoji: '👍',
            messageId: 'feedface',
        });
        await expect(added?.json()).resolves.toMatchObject({
            message: { reactions: [{ actors: [{ handle: 'Otto' }], emoji: '👍' }] },
        });

        const removed = await request('POST', '/api/agent/messages/react', {
            emoji: '👍',
            messageId: 'feedface',
            remove: true,
        });
        const removedBody = (await removed?.json()) as { message: Record<string, unknown> };
        expect(removedBody.message).not.toHaveProperty('reactions');

        seedMessage('msg_deadbeef000000000000000000000000');
        seedMessage('msg_deadbeefffffffffffffffffffffffff');
        const ambiguous = await request('POST', '/api/agent/messages/react', {
            emoji: '👍',
            messageId: 'deadbeef',
        });
        expect(ambiguous?.status).toBe(409);
        await expect(ambiguous?.json()).resolves.toMatchObject({ code: 'AMBIGUOUS_ID' });
    });

    it('shows and updates self profiles and resolves human handles', async () => {
        const self = await request('GET', '/api/agent/profile');
        await expect(self?.json()).resolves.toEqual({
            profile: { description: null, handle: 'Otto', isSelf: true },
        });

        const updated = await request('POST', '/api/agent/profile/update', {
            description: 'Resident investigator',
        });
        await expect(updated?.json()).resolves.toEqual({
            profile: { description: 'Resident investigator', handle: 'Otto', isSelf: true },
        });

        const now = new Date().toISOString();
        getDb()
            .prepare(
                `INSERT INTO identity_users (id, clerk_user_id, name, created_at, updated_at)
                 VALUES ('usr_zach', 'clerk_zach', 'Zach', $now, $now)`
            )
            .run({ $now: now });
        const human = await request('GET', '/api/agent/profile?target=%40Zach');
        await expect(human?.json()).resolves.toEqual({
            profile: { description: null, handle: 'Zach', isSelf: false },
        });
    });

    it('uploads, views, and sends hydrated attachments', async () => {
        const uploaded = await request('POST', '/api/agent/attachments/upload', {
            dataBase64: Buffer.from('hello').toString('base64'),
            filename: 'hello.txt',
            mediaType: 'text/plain',
        });
        const uploadedBody = (await uploaded?.json()) as {
            attachment: { id: string };
        };
        expect(uploadedBody.attachment.id).toMatch(/^att_[a-f0-9]{24}$/u);

        const viewed = await request('GET', `/api/agent/attachments/${uploadedBody.attachment.id}`);
        await expect(viewed?.json()).resolves.toMatchObject({
            attachment: {
                byteSize: 5,
                dataBase64: Buffer.from('hello').toString('base64'),
                filename: 'hello.txt',
                mediaType: 'text/plain',
            },
        });

        const sent = await request('POST', '/api/agent/messages/send', {
            attachmentIds: [uploadedBody.attachment.id],
            content: 'attached',
            target: '#general',
        });
        await expect(sent?.json()).resolves.toMatchObject({
            message: {
                attachments: [
                    {
                        byteSize: 5,
                        filename: 'hello.txt',
                        id: uploadedBody.attachment.id,
                        mediaType: 'text/plain',
                    },
                ],
            },
        });

        // A missing id is indistinguishable from one the caller can't see:
        // both resolve through the visibility query and fail closed, so
        // attachment existence never leaks.
        const missing = await request('POST', '/api/agent/messages/send', {
            attachmentIds: ['att_missing'],
            content: 'missing',
            target: '#general',
        });
        expect(missing?.status).toBe(403);
        await expect(missing?.json()).resolves.toMatchObject({ code: 'ATTACHMENT_NOT_VISIBLE' });
    });

    it('lists, creates, views, and patches skills in a temporary library', async () => {
        const content = '---\nname: audit\ndescription: Audit carefully\n---\n\n# Audit\n';
        const created = await request('POST', '/api/agent/skills/create', {
            content,
            description: 'Audit carefully',
            name: 'Audit',
        });
        await expect(created?.json()).resolves.toMatchObject({
            skill: { editable: true, enabledForYou: true, id: 'audit' },
        });

        const listed = await request('GET', '/api/agent/skills');
        await expect(listed?.json()).resolves.toMatchObject({
            skills: expect.arrayContaining([
                expect.objectContaining({ enabledForYou: true, id: 'audit' }),
            ]),
        });

        const viewed = await request('GET', '/api/agent/skills/audit');
        const viewedBody = (await viewed?.json()) as { hash: string };
        expect(viewedBody.hash).toMatch(/^[a-f0-9]{64}$/u);

        const patched = await request('POST', '/api/agent/skills/patch', {
            content: `${content}\nBe precise.\n`,
            expectedHash: viewedBody.hash,
            skillId: 'audit',
        });
        expect(patched?.status).toBe(200);
        await expect(patched?.json()).resolves.toMatchObject({
            change: { beforeHash: viewedBody.hash, path: 'SKILL.md', skillId: 'audit' },
        });
    });

    function seedMessage(id: string) {
        createMessage('cht_general', { author_id: 'usr_tavern', content: id, id, role: 'user' });
    }

    function request(method: 'GET' | 'POST', pathname: string, body?: unknown) {
        return handleAgentApiRequest(
            new Request(`http://runtime.test${pathname}`, {
                ...(body === undefined
                    ? {}
                    : {
                          body: JSON.stringify(body),
                          headers: { 'content-type': 'application/json' },
                      }),
                method,
            }),
            'agt_otto',
            { attachmentsDir, skillsDir }
        );
    }
});
