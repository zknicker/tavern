import assert from 'node:assert/strict';
import test from 'node:test';
import { mergeSessionSummaries } from './list.ts';

test('mergeSessionSummaries prefers cron run aliases over the base cron session', () => {
    const sessions = mergeSessionSummaries({
        cronRunSessions: [
            {
                agentId: 'main',
                duration: '7s',
                id: 'run-1',
                key: 'agent:main:cron:job-1:run:run-1',
                messageCount: 4,
                name: 'daily-morning-briefing',
                parentSessionKey: null,
                platform: null,
                source: 'Cron: daily-morning-briefing',
                spawnedBy: null,
                startedAt: '2026-03-21T12:00:00.000Z',
                state: 'done',
                title: 'Cron: daily-morning-briefing',
                type: 'cron',
            },
        ],
        storedSessions: [
            {
                agentId: 'main',
                duration: 'live',
                id: 'latest',
                key: 'agent:main:cron:job-1',
                messageCount: 2,
                name: 'daily-morning-briefing',
                parentSessionKey: null,
                platform: null,
                source: 'Cron: daily-morning-briefing',
                spawnedBy: null,
                startedAt: '2026-03-21T21:18:00.000Z',
                state: 'running',
                title: 'Cron: daily-morning-briefing',
                type: 'cron',
            },
            {
                agentId: 'main',
                duration: 'live',
                id: 'discord-1',
                key: 'agent:main:discord:channel:1',
                messageCount: 10,
                name: '#general',
                parentSessionKey: null,
                platform: 'discord',
                source: 'discord:#general',
                spawnedBy: null,
                startedAt: '2026-03-21T21:20:00.000Z',
                state: 'running',
                title: 'discord:#general',
                type: 'chat',
            },
        ],
    });

    assert.deepEqual(
        sessions.map((session) => session.key),
        ['agent:main:discord:channel:1', 'agent:main:cron:job-1:run:run-1']
    );
});
