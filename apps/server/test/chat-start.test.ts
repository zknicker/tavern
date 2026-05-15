import { afterEach, mock, spyOn, test } from 'bun:test';
import assert from 'node:assert/strict';
import * as chatSave from '../src/chat/save.ts';
import * as chatSend from '../src/chat/send.ts';
import { startTavernChat } from '../src/chat/start.ts';

afterEach(() => {
    mock.restore();
});

const firstChatId = '220f46ed-2d7c-41dd-9d7e-d02691f1afc3';
const secondChatId = '5d9b79d7-3193-4c0c-849b-f64225ea7cad';

test('startTavernChat creates a bound chat and sends the first message', async () => {
    const createSpy = spyOn(chatSave, 'createTavernChat').mockResolvedValue({
        chatId: firstChatId,
    });
    const sendSpy = spyOn(chatSend, 'sendTavernChatMessage').mockResolvedValue({
        acceptedAt: '2026-04-06T14:00:00.000Z',
        chatId: firstChatId,
        clientMessageId: 'tavern-message:1',
        runId: 'run-1',
        sessionKey: `agent:agent:planner:tavern:channel:${firstChatId}`,
        status: 'accepted',
    });

    const result = await startTavernChat({
        agentId: 'agent:planner',
        content: 'Plan the spring launch and outline the next three moves.',
    });

    assert.deepEqual(result, {
        acceptedAt: '2026-04-06T14:00:00.000Z',
        chatId: firstChatId,
        clientMessageId: 'tavern-message:1',
        runId: 'run-1',
        sessionKey: `agent:agent:planner:tavern:channel:${firstChatId}`,
        status: 'accepted',
    });
    assert.deepEqual(createSpy.mock.calls[0]?.[0], {
        agentIds: ['agent:planner'],
        displayName: 'Plan the spring launch and outline the next three moves.',
    });
    assert.deepEqual(sendSpy.mock.calls[0]?.[0], {
        agentId: 'agent:planner',
        chatId: firstChatId,
        content: 'Plan the spring launch and outline the next three moves.',
    });
});

test('startTavernChat trims long first messages into a stable chat display name', async () => {
    const createSpy = spyOn(chatSave, 'createTavernChat').mockResolvedValue({
        chatId: secondChatId,
    });
    spyOn(chatSend, 'sendTavernChatMessage').mockResolvedValue({
        acceptedAt: '2026-04-06T14:00:00.000Z',
        chatId: secondChatId,
        clientMessageId: 'tavern-message:2',
        runId: 'run-2',
        sessionKey: `agent:agent:planner:tavern:channel:${secondChatId}`,
        status: 'accepted',
    });

    await startTavernChat({
        agentId: 'agent:planner',
        content:
            'This is a very long first message that should become a compact chat name instead of keeping the whole prompt verbatim in the chats list.',
    });

    assert.equal(
        createSpy.mock.calls[0]?.[0]?.displayName,
        'This is a very long first message that should become a compact chat...'
    );
});
