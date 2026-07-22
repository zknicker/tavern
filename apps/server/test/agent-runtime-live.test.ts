import { afterEach, mock, spyOn, test } from 'bun:test';
import assert from 'node:assert/strict';
import { applyObservedAgentRuntimeEvent } from '../src/agent-runtime/event-sync.ts';
import * as invalidationEvents from '../src/api/invalidation-events.ts';
import { ensureDatabaseSchema } from '../src/db/bootstrap.ts';

const chatId = '220f46ed-2d7c-41dd-9d7e-d02691f1afc3';
const sessionKey = `agent:agent:planner:tavern:channel:${chatId}`;

ensureDatabaseSchema();

afterEach(() => {
    mock.restore();
});

test('applyObservedAgentRuntimeEvent invalidates session queries for session updates without a connection', async () => {
    const invalidateSpy = spyOn(invalidationEvents, 'emitSessionUpdated').mockImplementation();
    const workersSpy = spyOn(invalidationEvents, 'emitWorkersUpdated').mockImplementation();

    await applyObservedAgentRuntimeEvent({
        session: {
            agentId: 'agent:planner',
            channel: null,
            chatId,
            key: sessionKey,
            lastActivityAt: '2026-04-06T12:10:00.000Z',
            messageCount: 2,
            parentSessionKey: null,
            platform: 'tavern',
            sessionId: 'session-1',
            sessionRole: 'main',
            startedAt: '2026-04-06T12:05:00.000Z',
            title: 'Planning',
        },
        timestamp: '2026-04-06T12:10:01.000Z',
        type: 'session.updated',
    });

    assert.equal(invalidateSpy.mock.calls.length, 1);
    assert.equal(workersSpy.mock.calls.length, 1);
});

test('applyObservedAgentRuntimeEvent invalidates session queries for session invalidations without a connection', async () => {
    const invalidateSpy = spyOn(invalidationEvents, 'emitSessionUpdated').mockImplementation();
    const workersSpy = spyOn(invalidationEvents, 'emitWorkersUpdated').mockImplementation();

    await applyObservedAgentRuntimeEvent({
        sessionKey,
        timestamp: '2026-04-06T12:10:01.000Z',
        type: 'session.invalidated',
    });

    assert.equal(invalidateSpy.mock.calls.length, 1);
    assert.equal(workersSpy.mock.calls.length, 1);
});

test('applyObservedAgentRuntimeEvent invalidates agent queries on agent updates', async () => {
    const invalidateSpy = spyOn(invalidationEvents, 'emitAgentUpdated').mockImplementation();

    await applyObservedAgentRuntimeEvent({
        agentId: 'agent:planner',
        timestamp: '2026-04-06T12:10:01.000Z',
        type: 'agent.updated',
    });

    assert.equal(invalidateSpy.mock.calls.length, 1);
});
