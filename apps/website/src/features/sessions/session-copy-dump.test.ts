import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSessionCopyDump } from './session-copy-dump.ts';

test('buildSessionCopyDump preserves the procedure, input, and payload', () => {
    const dump = buildSessionCopyDump({
        data: {
            offset: 2,
            parentRelationship: null,
            rows: [],
            session: {
                agentId: 'agent-main',
                duration: '8s',
                id: 'discord-general-session',
                invokedBy: null,
                key: 'agent:main:discord:general',
                messageCount: 12,
                name: '#general',
                parentSessionKey: null,
                platform: 'discord',
                source: '#general',
                spawnedBy: null,
                startedAt: '2026-03-21T20:00:00.000Z',
                state: 'done',
                title: '#general',
                toolCalls: 3,
                type: 'chat',
            },
            total: 12,
        },
        input: {
            limit: 10,
            offset: 5,
            sessionKey: 'agent:main:discord:general',
        },
        procedure: 'session.history.get',
    });

    assert.deepEqual(JSON.parse(dump), {
        data: {
            offset: 2,
            parentRelationship: null,
            rows: [],
            session: {
                agentId: 'agent-main',
                duration: '8s',
                id: 'discord-general-session',
                invokedBy: null,
                key: 'agent:main:discord:general',
                messageCount: 12,
                name: '#general',
                parentSessionKey: null,
                platform: 'discord',
                source: '#general',
                spawnedBy: null,
                startedAt: '2026-03-21T20:00:00.000Z',
                state: 'done',
                title: '#general',
                toolCalls: 3,
                type: 'chat',
            },
            total: 12,
        },
        input: {
            limit: 10,
            offset: 5,
            sessionKey: 'agent:main:discord:general',
        },
        procedure: 'session.history.get',
    });
});
