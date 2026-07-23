import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeAgentApiTestDb, initAgentApiTestDb } from './agent-api-test-helper.ts';
import { uploadAgentAttachment, viewAgentAttachment } from './agent-attachments.ts';
import { sendAgentMessage } from './agent-send.ts';
import { upsertStoredAgent } from './agents-store.ts';
import { createChat, createMessage } from './chat-api/index.ts';

describe('agent attachment visibility', () => {
    let attachmentsDir: string;
    let root: string;

    beforeEach(() => {
        root = initAgentApiTestDb('tavern-agent-attachments-');
        attachmentsDir = path.join(root, 'attachments');
        seedAgent('agt_one', 'One');
        seedAgent('agt_two', 'Two');
        createChat({
            id: 'cht_one',
            kind: 'channel',
            participants: [
                { id: 'agt_one', kind: 'agent', label: 'One', metadata: { agentId: 'agt_one' } },
            ],
            title: 'one',
        });
        createChat({
            id: 'cht_two',
            kind: 'channel',
            participants: [
                { id: 'agt_two', kind: 'agent', label: 'Two', metadata: { agentId: 'agt_two' } },
            ],
            title: 'two',
        });
    });

    afterEach(async () => await closeAgentApiTestDb(root));

    it('allows the uploader to read an unposted upload', async () => {
        const uploaded = await upload('agt_one', 'private.txt');

        await expect(viewAgentAttachment('agt_one', uploaded.id)).resolves.toMatchObject({
            attachment: { dataBase64: Buffer.from('secret').toString('base64') },
        });
    });

    it('rejects a non-member reading a posted attachment', async () => {
        const uploaded = await upload('agt_one', 'posted.txt');
        createMessage('cht_one', {
            attachments: [uploaded],
            author_id: 'agt_one',
            content: 'posted',
            id: 'msg_10000000000000000000000000000001',
            role: 'assistant',
        });

        await expect(viewAgentAttachment('agt_two', uploaded.id)).rejects.toMatchObject({
            code: 'ATTACHMENT_NOT_VISIBLE',
        });
    });

    it("rejects another agent reposting the uploader's unposted attachment", async () => {
        const uploaded = await upload('agt_one', 'unposted.txt');

        expect(() =>
            sendAgentMessage('agt_two', {
                attachmentIds: [uploaded.id],
                content: 'repost',
                target: '#two',
            })
        ).toThrow(expect.objectContaining({ code: 'ATTACHMENT_NOT_VISIBLE' }));
    });

    async function upload(agentId: string, filename: string) {
        const result = await uploadAgentAttachment(
            agentId,
            {
                dataBase64: Buffer.from('secret').toString('base64'),
                filename,
                mediaType: 'text/plain',
            },
            { attachmentsDir }
        );
        return result.attachment;
    }

    function seedAgent(id: string, name: string) {
        upsertStoredAgent({
            agent: {
                enabledSkillIds: [],
                id,
                isAdmin: false,
                name,
                primaryColor: null,
                workspaceFolder: root,
            },
        });
    }
});
