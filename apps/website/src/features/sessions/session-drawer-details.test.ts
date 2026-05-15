import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSessionDetailRows } from './session-drawer-details.tsx';

test('buildSessionDetailRows includes platform, source, and session key', () => {
    assert.deepEqual(
        buildSessionDetailRows({
            id: 'claude-session-123',
            parentSessionKey: null,
            platform: 'discord',
            sessionKey: 'agent:planner:discord:channel:launch-room',
            source: '#launch-room',
        }),
        [
            {
                label: 'Platform',
                value: 'Discord',
            },
            {
                label: 'Source',
                value: '#launch-room',
            },
            {
                label: 'Session key',
                value: 'agent:planner:discord:channel:launch-room',
            },
            {
                label: 'Session ID',
                value: 'claude-session-123',
            },
        ]
    );
});

test('buildSessionDetailRows appends optional provider and parent session values', () => {
    assert.deepEqual(
        buildSessionDetailRows({
            id: 'claude-session-123',
            parentSessionKey: 'agent:router:tavern:channel:220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
            platform: null,
            sessionKey: 'agent:planner:tavern:channel:220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
            source: 'Tavern',
        }),
        [
            {
                label: 'Platform',
                value: 'Tavern',
            },
            {
                label: 'Source',
                value: 'Tavern',
            },
            {
                label: 'Session key',
                value: 'agent:planner:tavern:channel:220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
            },
            {
                label: 'Session ID',
                value: 'claude-session-123',
            },
            {
                label: 'Parent session',
                value: 'agent:router:tavern:channel:220f46ed-2d7c-41dd-9d7e-d02691f1afc3',
            },
        ]
    );
});
