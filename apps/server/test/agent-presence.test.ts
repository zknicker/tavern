import { afterEach, mock, spyOn, test } from 'bun:test';
import assert from 'node:assert/strict';
import * as configuredClient from '../src/agent-runtime/configured-client.ts';
import * as agentCatalog from '../src/agents/catalog.ts';
import { listAgentPresence } from '../src/agents/presence.ts';

afterEach(() => {
    mock.restore();
});

test('listAgentPresence proxies the Runtime projection', async () => {
    const presence = [
        {
            agentId: 'agent-1',
            chatId: 'cht_room',
            chatTitle: 'Launch prep',
            since: '2026-07-15T12:00:00.000Z',
            state: 'busy' as const,
        },
    ];
    spyOn(configuredClient, 'createConfiguredAgentRuntimeClient').mockImplementation(
        () =>
            ({
                close() {},
                listAgentPresence: async () => ({ presence }),
            }) as never
    );

    assert.deepEqual(await listAgentPresence(), presence);
});

test('listAgentPresence degrades to idle when Runtime is unreachable', async () => {
    spyOn(configuredClient, 'createConfiguredAgentRuntimeClient').mockImplementation(
        () => null as never
    );
    spyOn(agentCatalog, 'listAgents').mockImplementation(
        async () =>
            [
                {
                    enabledSkillIds: null,
                    id: 'agent-1',
                    name: 'Alpha Agent',
                    primaryColor: null,
                    runtimeId: 'runtime-1',
                    updatedAt: '2026-03-13T00:00:00.000Z',
                },
            ] as never
    );

    assert.deepEqual(await listAgentPresence(), [
        {
            agentId: 'agent-1',
            chatId: null,
            chatTitle: null,
            since: null,
            state: 'idle',
        },
    ]);
});
