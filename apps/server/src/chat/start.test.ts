import { afterEach, mock, spyOn, test } from 'bun:test';
import assert from 'node:assert/strict';
import * as save from './save.ts';
import * as send from './send.ts';
import { startTavernChat } from './start.ts';

afterEach(() => {
    mock.restore();
});

test('startTavernChat stores the deterministic Tavern chat name', async () => {
    const createTavernChat = spyOn(save, 'createTavernChat').mockResolvedValue({
        chatId: '220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
    });
    const sendTavernChatMessage = spyOn(send, 'sendTavernChatMessage').mockResolvedValue({
        acceptedAt: '2026-04-17T18:00:00.000Z',
        chatId: '220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
        clientMessageId: 'msg_1',
        runId: 'run-1',
        sessionKey: 'session:chat-1',
        status: 'accepted',
    });

    const result = await startTavernChat({
        agentId: 'claw',
        content: 'Hey!',
    });

    assert.deepEqual(result, {
        acceptedAt: '2026-04-17T18:00:00.000Z',
        chatId: '220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
        clientMessageId: 'msg_1',
        runId: 'run-1',
        sessionKey: 'session:chat-1',
        status: 'accepted',
    });
    assert.deepEqual(createTavernChat.mock.calls, [
        [
            {
                agentIds: ['claw'],
                displayName: 'Hey!',
            },
        ],
    ]);
    assert.deepEqual(sendTavernChatMessage.mock.calls, [
        [
            {
                agentId: 'claw',
                chatId: '220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                content: 'Hey!',
            },
        ],
    ]);
});

test('startTavernChat can defer agent resolution to chat creation', async () => {
    const createTavernChat = spyOn(save, 'createTavernChat').mockResolvedValue({
        chatId: '220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
    });
    const sendTavernChatMessage = spyOn(send, 'sendTavernChatMessage').mockResolvedValue({
        acceptedAt: '2026-04-17T18:00:00.000Z',
        chatId: '220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
        clientMessageId: 'msg_1',
        runId: 'run-1',
        sessionKey: 'session:chat-1',
        status: 'accepted',
    });

    await startTavernChat({
        content: 'Hey!',
    });

    assert.deepEqual(createTavernChat.mock.calls, [
        [
            {
                agentIds: undefined,
                displayName: 'Hey!',
            },
        ],
    ]);
    assert.deepEqual(sendTavernChatMessage.mock.calls, [
        [
            {
                agentId: undefined,
                chatId: '220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                content: 'Hey!',
            },
        ],
    ]);
});

test('startTavernChat preserves the optimistic first message identity', async () => {
    spyOn(save, 'createTavernChat').mockResolvedValue({
        chatId: '220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
    });
    const sendTavernChatMessage = spyOn(send, 'sendTavernChatMessage').mockResolvedValue({
        acceptedAt: '2026-04-17T18:00:00.000Z',
        chatId: '220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
        clientMessageId: 'msg_draft_1',
        runId: 'run-1',
        sessionKey: 'session:chat-1',
        status: 'accepted',
    });

    await startTavernChat({
        agentId: 'claw',
        clientMessageId: 'msg_draft_1',
        content: 'Hey!',
        metadata: {
            tavern: {
                toolMentions: [
                    {
                        end: 5,
                        id: 'tool-1',
                        kind: 'tool',
                        label: 'Tool 1',
                        start: 0,
                        text: '@tool',
                    },
                ],
            },
        },
    });

    assert.deepEqual(sendTavernChatMessage.mock.calls, [
        [
            {
                agentId: 'claw',
                chatId: '220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                clientMessageId: 'msg_draft_1',
                content: 'Hey!',
                metadata: {
                    tavern: {
                        toolMentions: [
                            {
                                end: 5,
                                id: 'tool-1',
                                kind: 'tool',
                                label: 'Tool 1',
                                start: 0,
                                text: '@tool',
                            },
                        ],
                    },
                },
            },
        ],
    ]);
});
