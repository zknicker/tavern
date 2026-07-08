import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
    type AgentRuntimeCapabilityHealth,
    type AgentRuntimeCapabilityHealthId,
    agentRuntimeProtocolVersion,
} from '@tavern/api';

const directory = mkdtempSync(join(tmpdir(), 'tavern-event-sync-'));
process.env.DATABASE_PATH = join(directory, 'test.sqlite');

const [
    { ensureDatabaseSchema },
    { applyCatchUpRuntimeEvent, applyObservedAgentRuntimeEvent, shouldApplyCatchUpRuntimeEvent },
    activeTurnSessions,
    connectionService,
    { listReachableAgentRuntimeConnections },
    { subscribeToTavernEvent, tavernEventNames },
] = await Promise.all([
    import('../db/bootstrap.ts'),
    import('./event-sync.ts'),
    import('./active-turn-sessions.ts'),
    import('../agent-runtime-connection/service.ts'),
    import('../storage/agent-runtime-connections.ts'),
    import('../api/invalidation-events.ts'),
]);

ensureDatabaseSchema();

let runtimeCapabilityStates: Record<string, AgentRuntimeCapabilityHealth['state']> = {};

const runtimeServer = Bun.serve({
    fetch(request) {
        if (new URL(request.url).pathname === '/capabilities') {
            return Response.json(buildCapabilitySnapshot(runtimeCapabilityStates));
        }
        return new Response('not found', { status: 404 });
    },
    hostname: '127.0.0.1',
    port: 0,
});

test.after(() => {
    runtimeServer.stop(true);
});

test('capability.updated refreshes the cached runtime capability snapshot', async () => {
    process.env.TAVERN_RUNTIME_URL = `http://127.0.0.1:${runtimeServer.port}`;

    // Connect while the runtime still reports its engine checks as warming.
    // The first confirm seeds the environment record; the second mirrors the
    // post-subscribe confirm at boot, which caches the capability snapshot.
    runtimeCapabilityStates = {
        apiServer: 'unavailable',
        gateway: 'unavailable',
    };
    assert.equal(await connectionService.confirmAgentRuntimeConnection(), true);
    assert.equal(await connectionService.confirmAgentRuntimeConnection(), true);

    // The runtime flips healthy after the server cached the warming snapshot.
    runtimeCapabilityStates = { apiServer: 'healthy', gateway: 'healthy' };
    const stale = await connectionService.getAgentRuntimeConnection({
        refreshStatus: false,
    });
    assert.equal(capabilityState(stale, 'gateway'), 'unavailable');

    const [connection] = await listReachableAgentRuntimeConnections();
    assert.ok(connection, 'environment runtime connection record should be reachable');
    await applyObservedAgentRuntimeEvent(
        {
            capability: 'gateway',
            timestamp: new Date().toISOString(),
            type: 'capability.updated',
        },
        connection
    );

    const refreshed = await connectionService.getAgentRuntimeConnection({
        refreshStatus: false,
    });
    assert.equal(capabilityState(refreshed, 'gateway'), 'healthy');
    assert.equal(capabilityState(refreshed, 'apiServer'), 'healthy');
});

test('wiki.changed emits a Wiki invalidation event', async () => {
    const invalidation = nextWikiInvalidation();

    await applyObservedAgentRuntimeEvent({
        paths: ['Projects/Alpha.md'],
        reason: 'watch',
        scope: 'content',
        timestamp: '2026-06-21T12:00:00.000Z',
        type: 'wiki.changed',
    });

    await assert.doesNotReject(async () => {
        const event = await invalidation;
        assert.deepEqual(event.paths, ['Projects/Alpha.md']);
        assert.equal(event.reason, 'watch');
        assert.equal(event.scope, 'content');
        assert.equal(event.timestamp, '2026-06-21T12:00:00.000Z');
    });
});

test('runtime catch-up ignores historical turn events', () => {
    const turn = {
        agentId: 'agt_primary',
        chatId: 'cht_1',
        runId: 'run_1',
        sessionKey: 'ags_1',
        startedAt: '2026-06-21T12:00:00.000Z',
    };
    const timestamp = '2026-06-21T12:00:01.000Z';

    assert.equal(shouldApplyCatchUpRuntimeEvent({ timestamp, turn, type: 'turn.started' }), false);
    assert.equal(
        shouldApplyCatchUpRuntimeEvent({
            step: { id: 'step_1', kind: 'tool', label: 'Read file', status: 'active' },
            timestamp,
            turn,
            type: 'turn.progress',
        }),
        false
    );
    assert.equal(
        shouldApplyCatchUpRuntimeEvent({
            text: 'Working',
            timestamp,
            turn,
            type: 'turn.replyUpdated',
        }),
        false
    );
    assert.equal(
        shouldApplyCatchUpRuntimeEvent({
            sequence: 1,
            timestamp,
            turn,
            type: 'turn.statusUpdated',
        }),
        false
    );
    assert.equal(
        shouldApplyCatchUpRuntimeEvent({
            message: 'extra context',
            timestamp,
            turn,
            type: 'turn.steered',
        }),
        false
    );
    assert.equal(
        shouldApplyCatchUpRuntimeEvent({ timestamp, turn, type: 'turn.completed' }),
        false
    );
    assert.equal(
        shouldApplyCatchUpRuntimeEvent({ timestamp, turn, type: 'turn.cancelled' }),
        false
    );
    assert.equal(
        shouldApplyCatchUpRuntimeEvent({ error: 'failed', timestamp, turn, type: 'turn.failed' }),
        false
    );
    assert.equal(
        shouldApplyCatchUpRuntimeEvent({
            chatId: 'cht_1',
            timestamp,
            type: 'chat.historyChanged',
        }),
        true
    );
});

test('runtime catch-up terminal turns clear active session bookkeeping', async () => {
    const sessionKey = 'ags_catchup_terminal';
    const turn = {
        agentId: 'agt_primary',
        chatId: 'cht_1',
        runId: 'run_1',
        sessionKey,
        startedAt: '2026-06-21T12:00:00.000Z',
    };

    activeTurnSessions.markTurnSessionActive(sessionKey);
    assert.equal(activeTurnSessions.hasActiveTurnSession(sessionKey), true);

    await applyCatchUpRuntimeEvent({
        timestamp: '2026-06-21T12:00:05.000Z',
        turn,
        type: 'turn.completed',
    });

    assert.equal(activeTurnSessions.hasActiveTurnSession(sessionKey), false);
});

function capabilityState(
    connection: Awaited<ReturnType<typeof connectionService.getAgentRuntimeConnection>>,
    capability: string
) {
    return connection?.runtimeCapabilities.find((status) => status.capability === capability)
        ?.state;
}

function buildCapabilitySnapshot(states: Record<string, AgentRuntimeCapabilityHealth['state']>) {
    const timestamp = new Date().toISOString();
    return {
        capabilities: Object.entries(states).map(([id, state]) => ({
            checkedAt: timestamp,
            displayName: id,
            healthy: state === 'healthy',
            id: id as AgentRuntimeCapabilityHealthId,
            lastHealthyAt: state === 'healthy' ? timestamp : null,
            metadata: {},
            nextCheckAt: null,
            reason: state === 'healthy' ? null : 'The capability is warming up.',
            state,
            technicalMessage: null,
            updatedAt: timestamp,
        })),
        health: { ok: true, status: 'healthy', timestamp },
        info: {
            agentRuntimeId: 'tavern-agent-engine',
            name: 'Tavern Runtime',
            protocolVersion: agentRuntimeProtocolVersion,
            version: '1.0.0',
        },
    };
}

async function nextWikiInvalidation() {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
        controller.abort();
    }, 5000);

    try {
        for await (const event of subscribeToTavernEvent(
            tavernEventNames.wikiUpdated,
            controller.signal
        )) {
            clearTimeout(timeout);
            return event;
        }
    } finally {
        clearTimeout(timeout);
    }

    throw new Error('Timed out waiting for Wiki invalidation.');
}
