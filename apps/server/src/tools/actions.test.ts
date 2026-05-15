import assert from 'node:assert/strict';
import test from 'node:test';
import { buildToolActions } from './actions.ts';

test('buildToolActions returns spawned session actions for sessions_spawn', () => {
    const actions = buildToolActions({
        argumentsValue: {
            mode: 'run',
            runtime: 'subagent',
        },
        resultValue: {
            childSessionKey: 'agent:tiny:subagent:child-1',
        },
        toolName: 'sessions_spawn',
    });

    assert.deepEqual(actions, [
        {
            kind: 'open-session',
            label: 'Spawned Session',
            sessionKey: 'agent:tiny:subagent:child-1',
            subtitle: 'agent:tiny:subagent:child-1',
            title: 'Open spawned session',
            tone: 'sky',
        },
    ]);
});

test('buildToolActions returns list actions for sessions_list', () => {
    const actions = buildToolActions({
        argumentsValue: null,
        resultValue: {
            sessions: [
                {
                    displayName: 'Tiny ACP',
                    key: 'agent:tiny:acp:child-1',
                },
            ],
        },
        toolName: 'sessions_list',
    });

    assert.deepEqual(actions, [
        {
            kind: 'open-session',
            label: 'Session',
            sessionKey: 'agent:tiny:acp:child-1',
            subtitle: 'agent:tiny:acp:child-1',
            title: 'Tiny ACP',
            tone: 'sky',
        },
    ]);
});
