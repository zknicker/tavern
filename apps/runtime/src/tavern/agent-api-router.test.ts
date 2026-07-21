import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { handleAgentApiRequest } from './agent-api-router.ts';
import { closeAgentApiTestDb, initAgentApiTestDb } from './agent-api-test-helper.ts';
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
});

function seed(id: string) {
    createMessage('cht_general', { author_id: 'usr_tavern', content: id, id, role: 'user' });
}
