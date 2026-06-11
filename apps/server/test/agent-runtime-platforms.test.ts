import { afterEach, mock, spyOn, test } from 'bun:test';
import assert from 'node:assert/strict';
import { createAgentRuntimeClient } from '../src/agent-runtime/client.ts';
import {
    listAgentRuntimeBindings,
    saveAgentRuntimeBinding,
} from '../src/agent-runtime/platforms.ts';

afterEach(() => {
    mock.restore();
});

test('saveAgentRuntimeBinding posts Discord binding config to Runtime', async () => {
    const fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
        assert.equal(String(input), 'http://agent-runtime.test/bindings');
        assert.equal(init?.method, 'POST');
        assert.deepEqual(JSON.parse(String(init?.body)), {
            agentId: 'agent:ops',
            enabled: true,
            id: 'discord:primary',
            inboundMode: 'mention-only',
            match: {
                channelIds: ['123'],
                dmUserIds: [],
                guildIds: ['456'],
                parentChannelIds: [],
            },
            metadata: {
                clientId: 'client-1',
                publicKey: 'public-key-1',
            },
            name: 'Primary Discord',
            platform: 'discord',
            token: 'discord-token',
        });

        return new Response(
            JSON.stringify({
                agentId: 'agent:ops',
                enabled: true,
                id: 'discord:primary',
                inboundMode: 'mention-only',
                match: {
                    channelIds: ['123'],
                    dmUserIds: [],
                    guildIds: ['456'],
                    parentChannelIds: [],
                },
                metadata: {
                    clientId: 'client-1',
                    publicKey: 'public-key-1',
                },
                name: 'Primary Discord',
                platform: 'discord',
                status: 'configured',
                statusMessage: null,
                token: 'discord-token',
                updatedAt: '2026-04-16T21:00:00.000Z',
            }),
            {
                headers: { 'content-type': 'application/json' },
                status: 201,
            }
        );
    });

    const result = await saveAgentRuntimeBinding(
        {
            agentId: 'agent:ops',
            enabled: true,
            id: 'discord:primary',
            inboundMode: 'mention-only',
            match: {
                channelIds: ['123'],
                dmUserIds: [],
                guildIds: ['456'],
                parentChannelIds: [],
            },
            metadata: {
                clientId: 'client-1',
                publicKey: 'public-key-1',
            },
            name: 'Primary Discord',
            platform: 'discord',
            token: 'discord-token',
        },
        createAgentRuntimeClient('http://agent-runtime.test')
    );

    assert.deepEqual(result, {
        agentId: 'agent:ops',
        enabled: true,
        id: 'discord:primary',
        inboundMode: 'mention-only',
        match: {
            channelIds: ['123'],
            dmUserIds: [],
            guildIds: ['456'],
            parentChannelIds: [],
        },
        metadata: {
            clientId: 'client-1',
            publicKey: 'public-key-1',
        },
        name: 'Primary Discord',
        platform: 'discord',
        status: 'configured',
        statusMessage: null,
        token: 'discord-token',
        updatedAt: '2026-04-16T21:00:00.000Z',
    });
    assert.equal(fetchSpy.mock.calls.length, 1);
});

test('listAgentRuntimeBindings uses the binding collection route', async () => {
    const fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(async (input, _init) => {
        const url = String(input);

        assert.equal(url, 'http://agent-runtime.test/bindings');

        return new Response(
            JSON.stringify({
                bindings: [
                    {
                        agentId: 'agent:ops',
                        enabled: true,
                        id: 'discord:primary',
                        inboundMode: 'active',
                        match: {
                            channelIds: [],
                            dmUserIds: [],
                            guildIds: [],
                            parentChannelIds: [],
                        },
                        metadata: {},
                        name: 'Primary Discord',
                        platform: 'discord',
                        status: 'configured',
                        statusMessage: null,
                        token: 'discord-token',
                        updatedAt: '2026-04-16T21:00:00.000Z',
                    },
                ],
            }),
            {
                headers: { 'content-type': 'application/json' },
                status: 200,
            }
        );
    });

    const bindings = await listAgentRuntimeBindings(
        createAgentRuntimeClient('http://agent-runtime.test')
    );

    assert.equal(bindings[0]?.id, 'discord:primary');
    assert.equal(bindings[0]?.agentId, 'agent:ops');
    assert.equal(fetchSpy.mock.calls.length, 1);
});
