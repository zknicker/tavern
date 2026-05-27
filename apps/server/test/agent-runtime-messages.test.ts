import { afterEach, mock, spyOn, test } from 'bun:test';
import assert from 'node:assert/strict';
import { createAgentRuntimeClient } from '../src/agent-runtime/client.ts';

const chatId = '220f46ed-2d7c-41dd-9d7e-d02691f1afc3';
const sessionKey = `agent:agent:planner:tavern:channel:${chatId}`;

afterEach(() => {
    mock.restore();
});

test('postMessage submits a chat-scoped runtime message', async () => {
    const fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
        assert.equal(String(input), `http://agent-runtime.test/openclaw/chats/${chatId}/messages`);
        assert.equal(init?.method, 'POST');
        assert.deepEqual(JSON.parse(String(init?.body)), {
            agent: {
                agentId: 'agent:planner',
            },
            message: {
                content: 'Plan the next launch.',
                id: 'msg-1',
            },
            target: {
                externalId: null,
                sessionKey,
                target: `chat:${chatId}`,
                type: 'tavern',
            },
        });

        return new Response(
            JSON.stringify({
                acceptedAt: '2026-04-06T12:00:00.000Z',
                runId: 'run-1',
                sessionKey,
                status: 'accepted',
            }),
            {
                headers: { 'content-type': 'application/json' },
                status: 202,
            }
        );
    });

    const client = createAgentRuntimeClient('http://agent-runtime.test');
    const result = await client.postMessage(chatId, {
        agent: {
            agentId: 'agent:planner',
        },
        message: {
            content: 'Plan the next launch.',
            id: 'msg-1',
        },
        target: {
            externalId: null,
            sessionKey,
            target: `chat:${chatId}`,
            type: 'tavern',
        },
    });

    assert.deepEqual(result, {
        acceptedAt: '2026-04-06T12:00:00.000Z',
        runId: 'run-1',
        sessionKey,
        status: 'accepted',
    });
    assert.equal(fetchSpy.mock.calls.length, 1);
});
