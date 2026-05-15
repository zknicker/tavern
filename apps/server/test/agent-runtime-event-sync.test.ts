import { afterEach, beforeEach, expect, mock, test } from 'bun:test';

const emitAgentRuntimeUpdated = mock(() => undefined);
const emitAgentRuntimeCapabilityUpdated = mock(() => undefined);
const emitAgentUpdated = mock(() => undefined);
const emitCronUpdated = mock(() => undefined);
const emitSkillInvalidationCascade = mock(() => undefined);
const emitSyncDataUpdated = mock(() => undefined);
const emitWorkersUpdated = mock(() => undefined);
const agentRuntimeConnectionId = 'tavern-openclaw-managed';
const activateAgentRuntimeConnection = mock(async () => null);
const deleteAgentRuntimeConnection = mock(async () => undefined);
const disableAgentRuntimeConnection = mock(async () => undefined);
const getActiveAgentRuntimeConnection = mock(async () => null);
const getActiveProjectionRuntimeId = mock(async () => null);
const getDefaultAgentRuntimeConnection = mock(async () => null);
const getAgentRuntimeConnection = mock(async () => null);
const getLatestAgentRuntimeConnection = mock(async () => null);
const listAgentRuntimeConnections = mock(async () => []);
const listConfiguredAgentRuntimeConnections = mock(async () => []);
const listReachableAgentRuntimeConnections = mock(async () => [
    {
        id: 'runtime-1',
    },
]);
const markAgentRuntimeConnectionFailure = mock(async () => undefined);
const markAgentRuntimeConnectionReachable = mock(async () => undefined);
const markAgentRuntimeConnectionSync = mock(async () => undefined);
const refreshOpenClawSyncJobSchedules = mock(async () => undefined);
const requestAgentRuntimeSessionSync = mock(async () => undefined);
const saveAgentRuntimeConnection = mock(async () => null);
const createAgentRuntimeClientForConnection = mock(() => undefined);
const subscribeAgentRuntimeEventsForConnection = mock(async () => ({
    close() {},
}));
const syncAgentRuntimeAgents = mock(async () => undefined);
const syncAgentRuntimeCron = mock(async () => undefined);
const syncAgentRuntimeSession = mock(async () => ({ synced: 1 }));
const syncAgentRuntimeSessionMessages = mock(async () => undefined);
const syncAgentRuntimeSessionMessagesWithRetry = mock(async () => undefined);
const emitObservedAgentRuntimeEvent = mock(() => undefined);
const tavernChatId = '220f46ed-2d7c-41dd-9d7e-d02691f1afc3';

mock.module('../src/agent-runtime-connection/service.ts', () => ({
    markAgentRuntimeConnectionFailure,
    markAgentRuntimeConnectionReachable,
}));

mock.module('../src/api/invalidation-events.ts', () => ({
    emitAgentRuntimeCapabilityUpdated,
    emitAgentRuntimeUpdated,
    emitAgentUpdated,
    emitCronUpdated,
    emitSkillInvalidationCascade,
    emitSyncDataUpdated,
    emitWorkersUpdated,
}));

mock.module('../src/jobs/manager.ts', () => ({
    refreshOpenClawSyncJobSchedules,
}));

mock.module('../src/storage/agent-runtime-connections.ts', () => ({
    activateAgentRuntimeConnection,
    agentRuntimeConnectionId,
    deleteAgentRuntimeConnection,
    disableAgentRuntimeConnection,
    getActiveAgentRuntimeConnection,
    getActiveProjectionRuntimeId,
    getDefaultAgentRuntimeConnection,
    getAgentRuntimeConnection,
    getLatestAgentRuntimeConnection,
    listAgentRuntimeConnections,
    listConfiguredAgentRuntimeConnections,
    listReachableAgentRuntimeConnections,
    markAgentRuntimeConnectionSync,
    saveAgentRuntimeConnection,
}));

mock.module('../src/sync/agent-runtime-projections.ts', () => ({
    syncAgentRuntimeAgents,
    syncAgentRuntimeCron,
    syncAgentRuntimeSession,
    syncAgentRuntimeSessionMessages,
    syncAgentRuntimeSessionMessagesWithRetry,
}));

mock.module('../src/agent-runtime/drivers.ts', () => ({
    createAgentRuntimeClientForConnection,
    subscribeAgentRuntimeEventsForConnection,
}));

mock.module('../src/agent-runtime/sync.ts', () => ({
    requestAgentRuntimeSessionSync,
}));

mock.module('../src/agent-runtime/events.ts', () => ({
    emitObservedAgentRuntimeEvent,
}));

const { applyObservedAgentRuntimeEvent, startAgentRuntimeEventSync } = await import(
    '../src/agent-runtime/event-sync.ts'
);

beforeEach(() => {
    emitAgentRuntimeUpdated.mockClear();
    emitAgentRuntimeCapabilityUpdated.mockClear();
    emitAgentUpdated.mockClear();
    emitCronUpdated.mockClear();
    emitSkillInvalidationCascade.mockClear();
    emitSyncDataUpdated.mockClear();
    emitWorkersUpdated.mockClear();
    emitObservedAgentRuntimeEvent.mockClear();
    activateAgentRuntimeConnection.mockClear();
    deleteAgentRuntimeConnection.mockClear();
    disableAgentRuntimeConnection.mockClear();
    getActiveAgentRuntimeConnection.mockClear();
    getActiveProjectionRuntimeId.mockClear();
    getDefaultAgentRuntimeConnection.mockClear();
    getAgentRuntimeConnection.mockClear();
    getLatestAgentRuntimeConnection.mockClear();
    listAgentRuntimeConnections.mockClear();
    listConfiguredAgentRuntimeConnections.mockClear();
    listReachableAgentRuntimeConnections.mockClear();
    markAgentRuntimeConnectionFailure.mockClear();
    markAgentRuntimeConnectionReachable.mockClear();
    markAgentRuntimeConnectionSync.mockClear();
    refreshOpenClawSyncJobSchedules.mockClear();
    requestAgentRuntimeSessionSync.mockClear();
    saveAgentRuntimeConnection.mockClear();
    createAgentRuntimeClientForConnection.mockClear();
    subscribeAgentRuntimeEventsForConnection.mockClear();
    syncAgentRuntimeAgents.mockClear();
    syncAgentRuntimeCron.mockClear();
    syncAgentRuntimeSession.mockClear();
    syncAgentRuntimeSessionMessages.mockClear();
    syncAgentRuntimeSessionMessagesWithRetry.mockClear();
});

afterEach(() => {
    mock.restore();
});

test('startAgentRuntimeEventSync refreshes connection state and schedules when the stream connects', async () => {
    startAgentRuntimeEventSync();
    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(subscribeAgentRuntimeEventsForConnection).toHaveBeenCalledTimes(1);
    expect(markAgentRuntimeConnectionReachable).toHaveBeenCalledWith({
        connectionId: 'runtime-1',
    });
    expect(refreshOpenClawSyncJobSchedules).toHaveBeenCalledTimes(1);
    expect(emitAgentRuntimeUpdated).toHaveBeenCalledTimes(1);
});

test('applyObservedAgentRuntimeEvent syncs completed turn history for the exact session', async () => {
    const client = { listSessionMessages: async () => ({ messages: [] }) };
    createAgentRuntimeClientForConnection.mockReturnValue(client as never);

    await applyObservedAgentRuntimeEvent(
        {
            timestamp: '2026-05-12T19:00:00.000Z',
            turn: {
                agentId: 'agent:test',
                chatId: tavernChatId,
                runId: 'run-1',
                sessionKey: 'session-1',
                startedAt: '2026-05-12T19:00:00.000Z',
            },
            type: 'turn.completed',
        },
        {
            id: 'runtime-1',
        } as never
    );
    await Promise.resolve();

    expect(syncAgentRuntimeSession).toHaveBeenCalledWith({
        client,
        runtimeId: 'runtime-1',
        sessionKey: 'session-1',
    });
    expect(syncAgentRuntimeSessionMessagesWithRetry).toHaveBeenCalledWith({
        agentId: 'agent:test',
        client,
        runtimeId: 'runtime-1',
        sessionKey: 'session-1',
    });
    expect(emitObservedAgentRuntimeEvent).toHaveBeenCalledWith({
        timestamp: '2026-05-12T19:00:00.000Z',
        turn: {
            agentId: 'agent:test',
            chatId: tavernChatId,
            runId: 'run-1',
            sessionKey: 'session-1',
            startedAt: '2026-05-12T19:00:00.000Z',
        },
        type: 'turn.completed',
    });
});

test('applyObservedAgentRuntimeEvent does not sync history for live reply updates', async () => {
    const client = { listSessionMessages: async () => ({ messages: [] }) };
    createAgentRuntimeClientForConnection.mockReturnValue(client as never);

    await applyObservedAgentRuntimeEvent(
        {
            isThinking: false,
            replace: true,
            text: 'Ready.',
            timestamp: '2026-05-12T19:00:00.000Z',
            turn: {
                agentId: 'agent:test',
                chatId: tavernChatId,
                runId: 'run-1',
                sessionKey: 'session-1',
                startedAt: '2026-05-12T19:00:00.000Z',
            },
            type: 'turn.replyUpdated',
        },
        {
            id: 'runtime-1',
        } as never
    );
    await Promise.resolve();

    expect(createAgentRuntimeClientForConnection).not.toHaveBeenCalled();
    expect(syncAgentRuntimeSession).not.toHaveBeenCalled();
    expect(syncAgentRuntimeSessionMessages).not.toHaveBeenCalled();
    expect(syncAgentRuntimeSessionMessagesWithRetry).not.toHaveBeenCalled();
    expect(emitObservedAgentRuntimeEvent).toHaveBeenCalledWith({
        isThinking: false,
        replace: true,
        text: 'Ready.',
        timestamp: '2026-05-12T19:00:00.000Z',
        turn: {
            agentId: 'agent:test',
            chatId: tavernChatId,
            runId: 'run-1',
            sessionKey: 'session-1',
            startedAt: '2026-05-12T19:00:00.000Z',
        },
        type: 'turn.replyUpdated',
    });
});

test('applyObservedAgentRuntimeEvent defers invalidated session sync while a turn is active', async () => {
    const client = { listSessionMessages: async () => ({ messages: [] }) };
    createAgentRuntimeClientForConnection.mockReturnValue(client as never);
    const connection = {
        id: 'runtime-1',
    } as never;

    await applyObservedAgentRuntimeEvent(
        {
            timestamp: '2026-05-12T19:00:00.000Z',
            turn: {
                agentId: 'agent:test',
                chatId: tavernChatId,
                runId: 'run-1',
                sessionKey: 'session-1',
                startedAt: '2026-05-12T19:00:00.000Z',
            },
            type: 'turn.started',
        },
        connection
    );
    await applyObservedAgentRuntimeEvent(
        {
            sessionKey: 'session-1',
            timestamp: '2026-05-12T19:00:01.000Z',
            type: 'session.invalidated',
        },
        connection
    );
    await flushAsyncEventSync();

    expect(createAgentRuntimeClientForConnection).not.toHaveBeenCalled();
    expect(syncAgentRuntimeSession).not.toHaveBeenCalled();
    expect(syncAgentRuntimeSessionMessages).not.toHaveBeenCalled();
    expect(syncAgentRuntimeSessionMessagesWithRetry).not.toHaveBeenCalled();
    expect(emitWorkersUpdated).toHaveBeenCalledTimes(1);
    expect(emitSyncDataUpdated).toHaveBeenCalledTimes(1);

    await applyObservedAgentRuntimeEvent(
        {
            timestamp: '2026-05-12T19:00:02.000Z',
            turn: {
                agentId: 'agent:test',
                chatId: tavernChatId,
                runId: 'run-1',
                sessionKey: 'session-1',
                startedAt: '2026-05-12T19:00:00.000Z',
            },
            type: 'turn.completed',
        },
        connection
    );
    await flushAsyncEventSync();

    expect(syncAgentRuntimeSession).toHaveBeenCalledWith({
        client,
        runtimeId: 'runtime-1',
        sessionKey: 'session-1',
    });
    expect(syncAgentRuntimeSessionMessagesWithRetry).toHaveBeenCalledWith({
        agentId: 'agent:test',
        client,
        runtimeId: 'runtime-1',
        sessionKey: 'session-1',
    });

    createAgentRuntimeClientForConnection.mockClear();
    syncAgentRuntimeSession.mockClear();
    syncAgentRuntimeSessionMessages.mockClear();
    syncAgentRuntimeSessionMessagesWithRetry.mockClear();

    await applyObservedAgentRuntimeEvent(
        {
            sessionKey: 'session-1',
            timestamp: '2026-05-12T19:00:03.000Z',
            type: 'session.invalidated',
        },
        connection
    );
    await flushAsyncEventSync();

    expect(syncAgentRuntimeSession).toHaveBeenCalledWith({
        client,
        runtimeId: 'runtime-1',
        sessionKey: 'session-1',
    });
    expect(syncAgentRuntimeSessionMessages).toHaveBeenCalledWith({
        client,
        runtimeId: 'runtime-1',
        sessionKey: 'session-1',
    });
    expect(syncAgentRuntimeSessionMessagesWithRetry).not.toHaveBeenCalled();
});

async function flushAsyncEventSync() {
    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
}
