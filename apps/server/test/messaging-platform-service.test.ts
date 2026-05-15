import { afterEach, mock, spyOn, test } from 'bun:test';
import assert from 'node:assert/strict';
import type { AgentRuntimeBinding } from '@tavern/agent-runtime-protocol';
import {
    listMessagingBindings,
    syncMessagingBindingsToAgentRuntime,
} from '../src/messaging-platform/service.ts';
import * as bindingStorage from '../src/storage/messaging-bindings.ts';

afterEach(() => {
    mock.restore();
});

function createBinding(overrides: Partial<AgentRuntimeBinding> = {}): AgentRuntimeBinding {
    return {
        agentId: 'agent:ops',
        enabled: true,
        id: 'discord:primary',
        inboundMode: 'mention-only',
        match: {
            channelIds: ['123'],
            guildIds: ['456'],
        },
        metadata: {
            clientId: 'client-1',
        },
        name: 'Primary Discord',
        platform: 'discord',
        status: 'configured',
        statusMessage: null,
        token: 'discord-token',
        updatedAt: '2026-04-18T16:00:00.000Z',
        ...overrides,
    };
}

test('listMessagingBindings returns canonical local bindings', async () => {
    const localBinding = createBinding({
        metadata: { clientId: 'client-1' },
        status: 'configured',
        statusMessage: null,
        updatedAt: '2026-04-18T16:00:00.000Z',
    });

    spyOn(bindingStorage, 'listStoredMessagingBindings').mockResolvedValue([localBinding]);

    const bindings = await listMessagingBindings();

    assert.deepEqual(bindings, [localBinding]);
});

test('syncMessagingBindingsToAgentRuntime skips work when no runtime is configured', async () => {
    const listStoredSpy = spyOn(bindingStorage, 'listStoredMessagingBindings').mockResolvedValue([
        createBinding(),
    ]);

    await syncMessagingBindingsToAgentRuntime();

    assert.equal(listStoredSpy.mock.calls.length, 0);
});
