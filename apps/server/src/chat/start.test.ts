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
        status: 'accepted',
        threadChatId: null,
    });

    const result = await startTavernChat({
        agentId: 'claw',
        content: 'Hey!',
    });

    assert.deepEqual(result, {
        acceptedAt: '2026-04-17T18:00:00.000Z',
        chatId: '220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
        clientMessageId: 'msg_1',
        status: 'accepted',
        threadChatId: null,
    });
    assert.deepEqual(createTavernChat.mock.calls, [
        [
            {
                agentIds: ['claw'],
                displayName: 'Hey!',
                displayNameSource: 'generated',
            },
            'usr_tavern',
        ],
    ]);
    assert.deepEqual(sendTavernChatMessage.mock.calls, [
        [
            {
                chatId: '220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                content: 'Hey!',
            },
            { clerkSessionToken: null },
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
        status: 'accepted',
        threadChatId: null,
    });

    await startTavernChat({
        content: 'Hey!',
    });

    assert.deepEqual(createTavernChat.mock.calls, [
        [
            {
                agentIds: undefined,
                displayName: 'Hey!',
                displayNameSource: 'generated',
            },
            'usr_tavern',
        ],
    ]);
    assert.deepEqual(sendTavernChatMessage.mock.calls, [
        [
            {
                chatId: '220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                content: 'Hey!',
            },
            { clerkSessionToken: null },
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
        status: 'accepted',
        threadChatId: null,
    });

    await startTavernChat({
        agentId: 'claw',
        clientMessageId: 'msg_draft_1',
        content: 'Hey!',
    });

    assert.deepEqual(sendTavernChatMessage.mock.calls, [
        [
            {
                chatId: '220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
                clientMessageId: 'msg_draft_1',
                content: 'Hey!',
            },
            { clerkSessionToken: null },
        ],
    ]);
});
