import { afterEach, mock, spyOn, test } from 'bun:test';
import assert from 'node:assert/strict';
import { applyObservedAgentRuntimeEvent } from '../src/agent-runtime/event-sync.ts';
import * as agentRuntimeSync from '../src/agent-runtime/sync.ts';
import * as invalidationEvents from '../src/api/invalidation-events.ts';
import { ensureDatabaseSchema } from '../src/db/bootstrap.ts';

const chatId = '220f46ed-2d7c-41dd-9d7e-d02691f1afc3';
const sessionKey = `agent:agent:planner:tavern:channel:${chatId}`;

ensureDatabaseSchema();

afterEach(() => {
    mock.restore();
});

test('applyObservedAgentRuntimeEvent requests a session sync for session updates', async () => {
    const syncSpy = spyOn(agentRuntimeSync, 'requestAgentRuntimeSessionSync').mockResolvedValue();
    const invalidateSpy = spyOn(invalidationEvents, 'emitSyncDataUpdated').mockImplementation();
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

    assert.equal(syncSpy.mock.calls.length, 1);
    assert.equal(invalidateSpy.mock.calls.length, 1);
    assert.equal(workersSpy.mock.calls.length, 1);
});

test('applyObservedAgentRuntimeEvent requests a session sync for session invalidations', async () => {
    const syncSpy = spyOn(agentRuntimeSync, 'requestAgentRuntimeSessionSync').mockResolvedValue();
    const invalidateSpy = spyOn(invalidationEvents, 'emitSyncDataUpdated').mockImplementation();
    const workersSpy = spyOn(invalidationEvents, 'emitWorkersUpdated').mockImplementation();

    await applyObservedAgentRuntimeEvent({
        sessionKey,
        timestamp: '2026-04-06T12:10:01.000Z',
        type: 'session.invalidated',
    });

    assert.equal(syncSpy.mock.calls.length, 1);
    assert.equal(invalidateSpy.mock.calls.length, 1);
    assert.equal(workersSpy.mock.calls.length, 1);
});

test('applyObservedAgentRuntimeEvent invalidates agents on agent updates', async () => {
    const invalidateSpy = spyOn(invalidationEvents, 'emitAgentUpdated').mockImplementation();

    await applyObservedAgentRuntimeEvent({
        agentId: 'agent:planner',
        timestamp: '2026-04-06T12:10:01.000Z',
        type: 'agent.updated',
    });

    assert.equal(invalidateSpy.mock.calls.length, 1);
});

test('applyObservedAgentRuntimeEvent invalidates runtime-owned skill queries on update', async () => {
    const invalidateSpy = spyOn(
        invalidationEvents,
        'emitSkillInvalidationCascade'
    ).mockImplementation();

    await applyObservedAgentRuntimeEvent({
        skillId: 'agent-browser',
        timestamp: '2026-04-06T12:10:01.000Z',
        type: 'skill.updated',
    });

    assert.equal(invalidateSpy.mock.calls.length, 1);
});

test('applyObservedAgentRuntimeEvent invalidates runtime-owned skill queries on delete', async () => {
    const invalidateSpy = spyOn(
        invalidationEvents,
        'emitSkillInvalidationCascade'
    ).mockImplementation();

    await applyObservedAgentRuntimeEvent({
        skillId: 'agent-browser',
        timestamp: '2026-04-06T12:10:01.000Z',
        type: 'skill.deleted',
    });

    assert.equal(invalidateSpy.mock.calls.length, 1);
});

test('applyObservedAgentRuntimeEvent invalidates runtime-owned cron queries on update', async () => {
    const cronSpy = spyOn(invalidationEvents, 'emitCronUpdated').mockImplementation();
    const syncSpy = spyOn(invalidationEvents, 'emitSyncDataUpdated').mockImplementation();

    await applyObservedAgentRuntimeEvent({
        cronJobId: 'cron:daily-standup',
        timestamp: '2026-04-06T12:10:01.000Z',
        type: 'cron.updated',
    });

    assert.equal(cronSpy.mock.calls.length, 1);
    assert.equal(syncSpy.mock.calls.length, 1);
});

test('applyObservedAgentRuntimeEvent invalidates runtime-owned cron queries on delete', async () => {
    const cronSpy = spyOn(invalidationEvents, 'emitCronUpdated').mockImplementation();
    const syncSpy = spyOn(invalidationEvents, 'emitSyncDataUpdated').mockImplementation();

    await applyObservedAgentRuntimeEvent({
        cronJobId: 'cron:daily-standup',
        timestamp: '2026-04-06T12:10:01.000Z',
        type: 'cron.deleted',
    });

    assert.equal(cronSpy.mock.calls.length, 1);
    assert.equal(syncSpy.mock.calls.length, 1);
});
