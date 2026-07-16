import assert from 'node:assert/strict';
import test from 'node:test';
import type { AgentRuntimeChat } from '@tavern/api';
import { buildCronDeliveryTargets } from './delivery-targets.ts';

const productChatId = '220f46ed-2d7c-41dd-9d7e-d02691f1afc3';

function createAgentRuntimeChat(
    input: Partial<AgentRuntimeChat> & Pick<AgentRuntimeChat, 'id'>
): AgentRuntimeChat {
    const { id, ...overrides } = input;

    return {
        bindingId: null,
        bindings: [],
        activeTurnParticipantIds: [],
        id,
        inboundMode: 'observe',
        metadata: {},
        parentTarget: null,
        participants: [{ agentId: 'agt_agent-1', type: 'agent' }],
        platform: 'discord',
        platformMetadata: null,
        requiresTrigger: false,
        scope: 'channel',
        target: null,
        trigger: null,
        unreadCount: 0,
        ...overrides,
    };
}

test('buildCronDeliveryTargets returns only configured chats that can send outbound messages', () => {
    const targets = buildCronDeliveryTargets(
        [
            createAgentRuntimeChat({
                id: productChatId,
                metadata: { tavern: { displayName: 'Product' } },
                platform: 'tavern',
                scope: null,
                target: `chat:${productChatId}`,
            }),
            createAgentRuntimeChat({
                id: 'cht_task',
                metadata: { tavern: { displayName: 'T-1: Task' } },
                platform: 'tavern',
                scope: 'task',
                target: 'task:cht_task',
            }),
            createAgentRuntimeChat({
                bindingId: 'discord:binding:1',
                id: 'discord:channel:111',
                platform: 'discord',
                platformMetadata: {
                    accountIds: [],
                    channel: { id: '111', name: 'announcements' },
                    dm: null,
                    guild: null,
                    observedLabels: ['#announcements'],
                    provider: 'discord',
                    sourceRecords: [],
                    thread: null,
                },
                scope: 'channel',
                target: 'channel:111',
            }),
            createAgentRuntimeChat({
                bindingId: 'slack:binding:1',
                id: 'slack:channel:C123',
                platform: 'slack',
                scope: 'channel',
                target: 'channel:C123',
            }),
            createAgentRuntimeChat({
                bindingId: 'discord:binding:2',
                id: 'discord:channel:222',
                platform: 'discord',
                target: null,
            }),
            createAgentRuntimeChat({
                id: 'discord:channel:333',
                platform: 'discord',
                target: 'channel:333',
            }),
        ],
        'agent-1'
    );

    assert.deepEqual(targets, [
        {
            chatId: 'discord:channel:111',
            label: '#announcements',
            platform: 'discord',
            scope: 'channel',
        },
        {
            chatId: 'slack:channel:C123',
            label: 'channel:C123',
            platform: 'slack',
            scope: 'channel',
        },
        {
            chatId: productChatId,
            label: 'Product',
            platform: 'tavern',
            scope: null,
        },
    ]);
});

test('buildCronDeliveryTargets keeps the first deliverable record for each chat id', () => {
    const targets = buildCronDeliveryTargets(
        [
            createAgentRuntimeChat({
                bindingId: 'discord:binding:1',
                id: 'discord:channel:111',
                platformMetadata: {
                    accountIds: [],
                    channel: { id: '111', name: 'general' },
                    dm: null,
                    guild: null,
                    observedLabels: ['#general'],
                    provider: 'discord',
                    sourceRecords: [],
                    thread: null,
                },
                target: 'channel:111',
            }),
            createAgentRuntimeChat({
                bindingId: 'discord:binding:2',
                id: 'discord:channel:111',
                platformMetadata: {
                    accountIds: [],
                    channel: { id: '111', name: 'general-renamed' },
                    dm: null,
                    guild: null,
                    observedLabels: ['#general renamed'],
                    provider: 'discord',
                    sourceRecords: [],
                    thread: null,
                },
                target: 'channel:111',
            }),
        ],
        'agent-1'
    );

    assert.deepEqual(targets, [
        {
            chatId: 'discord:channel:111',
            label: '#general',
            platform: 'discord',
            scope: 'channel',
        },
    ]);
});

test('buildCronDeliveryTargets filters chats by selected agent participant', () => {
    const targets = buildCronDeliveryTargets(
        [
            createAgentRuntimeChat({
                bindingId: 'discord:binding:1',
                id: 'discord:channel:111',
                target: 'channel:111',
            }),
            createAgentRuntimeChat({
                bindingId: 'discord:binding:2',
                id: 'discord:channel:222',
                participants: [{ agentId: 'agt_agent-2', type: 'agent' }],
                target: 'channel:222',
            }),
        ],
        'agent-1'
    );

    assert.deepEqual(
        targets.map((target) => target.chatId),
        ['discord:channel:111']
    );
});
