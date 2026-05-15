import { afterEach, mock, spyOn, test } from 'bun:test';
import assert from 'node:assert/strict';
import * as agentRuntimeChatStatus from '../src/agent-runtime/chat-status.ts';
import { AgentRuntimeRequestError } from '../src/agent-runtime/client.ts';
import { listChatStatuses } from '../src/chat/status.ts';

const chatId = '220f46ed-2d7c-41dd-9d7e-d02691f1afc3';
const sessionKey = `agent:agent:planner:tavern:channel:${chatId}`;

afterEach(() => {
    mock.restore();
});

test('listChatStatuses returns an empty list when runtime chat status is unavailable', async () => {
    spyOn(agentRuntimeChatStatus, 'listAgentRuntimeChatStatuses').mockResolvedValue(null);

    assert.deepEqual(await listChatStatuses(), {
        chats: [],
    });
});

test('listAgentRuntimeChatStatuses treats missing runtime status as unavailable', async () => {
    assert.equal(
        await agentRuntimeChatStatus.listAgentRuntimeChatStatuses({
            listChatStatuses: async () => {
                throw new AgentRuntimeRequestError({
                    code: 'not_found',
                    message: 'Not found.',
                    retryable: false,
                    status: 404,
                });
            },
        } as never),
        null
    );
});

test('listChatStatuses proxies runtime-owned active replies', async () => {
    spyOn(agentRuntimeChatStatus, 'listAgentRuntimeChatStatuses').mockResolvedValue({
        chats: [
            {
                activeReply: {
                    agentId: 'agent:planner',
                    runId: 'run-1',
                    sessionKey,
                    startedAt: '2026-04-20T18:14:00.000Z',
                },
                chatId,
            },
        ],
    });

    assert.deepEqual(await listChatStatuses(), {
        chats: [
            {
                activeReply: {
                    agentId: 'agent:planner',
                    runId: 'run-1',
                    sessionKey,
                    startedAt: '2026-04-20T18:14:00.000Z',
                },
                chatId,
            },
        ],
    });
});
