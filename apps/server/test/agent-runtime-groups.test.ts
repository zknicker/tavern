import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { buildTavernChatRecord } from '../src/agent-runtime/chats.ts';

test('buildTavernChatRecord creates an app-owned Tavern chat record', () => {
    const chatId = '220f46ed-2d7c-41dd-9d7e-d02691f1afc3';
    const sessionKey = `agent:agent:planner:tavern:channel:${chatId}`;
    const chat = buildTavernChatRecord({
        agentIds: ['agent:planner'],
        displayName: 'Planning',
        id: chatId,
    });

    assert.deepEqual(chat, {
        bindingId: null,
        bindings: [{ agentId: 'agent:planner' }],
        id: chatId,
        inboundMode: 'active',
        metadata: {
            tavern: {
                displayName: 'Planning',
            },
            sessionKeys: [sessionKey],
        },
        parentTarget: null,
        participants: [{ agentId: 'agent:planner', type: 'agent' }],
        platform: 'tavern',
        platformMetadata: {
            chatId,
            conversationId: null,
            observedLabels: ['Planning'],
            provider: 'tavern',
            sourceRecords: [
                {
                    chatId,
                    clientMessageId: null,
                    conversationId: null,
                    deliveryId: null,
                    runId: null,
                    sessionKey,
                    source: {
                        channel: 'tavern',
                        target: `chat:${chatId}`,
                    },
                },
            ],
        },
        requiresTrigger: false,
        scope: null,
        target: `chat:${chatId}`,
        trigger: null,
    });
});
