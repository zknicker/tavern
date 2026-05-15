import assert from 'node:assert/strict';
import test from 'node:test';
import { getMessageModelContext, getMessageSessionContext } from './message-context.ts';

test('getMessageModelContext trims provider prefixes for compact badges', () => {
    const context = getMessageModelContext({
        metadata: {
            model: 'anthropic/claude-3.7-sonnet',
            modelInfo: {
                label: 'claude-3.7-sonnet',
                model: 'anthropic/claude-3.7-sonnet',
                provider: 'openrouter',
            },
            provider: 'openrouter',
        },
    });

    assert.deepEqual(context, {
        badgeLabel: 'claude-3.7-sonnet',
        fullLabel: 'anthropic/claude-3.7-sonnet',
    });
});

test('getMessageSessionContext favors the synced session id and shortens it for the badge', () => {
    const context = getMessageSessionContext({
        sourceSessionId: 'session-9f83ac',
        sourceSessionKey: 'agent:tiny:discord:channel:session-9f83ac',
    });

    assert.deepEqual(context, {
        badgeLabel: 'session 9f83ac',
        fullLabel: 'session-9f83ac',
        sessionKey: 'agent:tiny:discord:channel:session-9f83ac',
    });
});
