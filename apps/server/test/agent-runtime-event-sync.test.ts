import { afterEach, beforeEach, expect, mock, test } from 'bun:test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), 'tavern-event-sync-')), 'test.sqlite');

const emitAgentRuntimeUpdated = mock(() => undefined);
const emitAgentRuntimeCapabilityUpdated = mock(() => undefined);
const emitAgentInvalidationCascade = mock(() => undefined);
const emitAgentUpdated = mock(() => undefined);
const emitChatLogUpdated = mock(() => undefined);
const emitChatUpdated = mock(() => undefined);
const emitCronUpdated = mock(() => undefined);
const emitJobsUpdated = mock(() => undefined);
const emitModelUpdated = mock(() => undefined);
const emitOpenClawConfigUpdated = mock(() => undefined);
const emitOpenRouterSettingsInvalidationCascade = mock(() => undefined);
const emitOpenRouterSettingsUpdated = mock(() => undefined);
const emitSessionUpdated = mock(() => undefined);
const emitSkillInvalidationCascade = mock(() => undefined);
const emitSkillUpdated = mock(() => undefined);
const emitTavernEvent = mock(() => undefined);
const emitUsageLiveUpdated = mock(() => undefined);
const emitWorkersUpdated = mock(() => undefined);
const markAgentRuntimeConnectionFailure = mock(async () => undefined);
const markAgentRuntimeConnectionReachable = mock(async () => undefined);
const createAgentRuntimeClientForConnection = mock(() => undefined);
const subscribeAgentRuntimeEventsForConnection = mock(async () => ({
    close() {},
}));
const emitObservedAgentRuntimeEvent = mock(() => undefined);
const confirmAgentRuntimeConnection = mock(async () => true);
const refreshOpenClawGatewayCapability = mock(async () => undefined);
const recordTavernPluginCapability = mock(async () => undefined);
const tavernChatId = '220f46ed-2d7c-41dd-9d7e-d02691f1afc3';
const originalFetch = globalThis.fetch;
let tavernApiRequests: Array<{ body: unknown; method: string; path: string }> = [];

mock.module('../src/agent-runtime-connection/service.ts', () => ({
    confirmAgentRuntimeConnection,
    markAgentRuntimeConnectionFailure,
    markAgentRuntimeConnectionReachable,
}));

mock.module('../src/agent-runtime-connection/openclaw-gateway-capability.ts', () => ({
    refreshOpenClawGatewayCapability,
}));

mock.module('../src/agent-runtime-connection/tavern-plugin-capability.ts', () => ({
    recordTavernPluginCapability,
}));

mock.module('../src/api/invalidation-events.ts', () => ({
    emitAgentInvalidationCascade,
    emitAgentRuntimeCapabilityUpdated,
    emitAgentRuntimeUpdated,
    emitAgentUpdated,
    emitChatLogUpdated,
    emitChatUpdated,
    emitCronUpdated,
    emitJobsUpdated,
    emitModelUpdated,
    emitOpenClawConfigUpdated,
    emitOpenRouterSettingsInvalidationCascade,
    emitOpenRouterSettingsUpdated,
    emitSessionUpdated,
    emitSkillInvalidationCascade,
    emitSkillUpdated,
    emitTavernEvent,
    emitUsageLiveUpdated,
    emitWorkersUpdated,
}));

mock.module('../src/agent-runtime/drivers.ts', () => ({
    createAgentRuntimeClientForConnection,
    subscribeAgentRuntimeEventsForConnection,
}));

mock.module('../src/agent-runtime/events.ts', () => ({
    emitObservedAgentRuntimeEvent,
}));

const { ensureDatabaseSchema } = await import('../src/db/bootstrap.ts');
ensureDatabaseSchema();
const { databaseClient } = await import('../src/db/index.ts');
const { saveAgentRuntimeConnection } = await import('../src/storage/agent-runtime-connections.ts');
const { applyObservedAgentRuntimeEvent, startAgentRuntimeEventSync } = await import(
    '../src/agent-runtime/event-sync.ts'
);

beforeEach(async () => {
    databaseClient.exec('DELETE FROM agent_runtime_connections;');
    await saveAgentRuntimeConnection({
        baseUrl: 'http://runtime.test',
        enabled: true,
        id: 'runtime-1',
        isActive: true,
        lastCheckedAt: '2026-05-12T19:00:00.000Z',
        lastError: null,
        name: 'Runtime',
    });
    emitAgentRuntimeUpdated.mockClear();
    emitAgentRuntimeCapabilityUpdated.mockClear();
    emitAgentInvalidationCascade.mockClear();
    emitAgentUpdated.mockClear();
    emitCronUpdated.mockClear();
    emitJobsUpdated.mockClear();
    emitModelUpdated.mockClear();
    emitOpenClawConfigUpdated.mockClear();
    emitOpenRouterSettingsInvalidationCascade.mockClear();
    emitOpenRouterSettingsUpdated.mockClear();
    emitSessionUpdated.mockClear();
    emitSkillInvalidationCascade.mockClear();
    emitSkillUpdated.mockClear();
    emitChatLogUpdated.mockClear();
    emitChatUpdated.mockClear();
    emitTavernEvent.mockClear();
    emitUsageLiveUpdated.mockClear();
    emitWorkersUpdated.mockClear();
    emitObservedAgentRuntimeEvent.mockClear();
    confirmAgentRuntimeConnection.mockClear();
    refreshOpenClawGatewayCapability.mockClear();
    recordTavernPluginCapability.mockClear();
    markAgentRuntimeConnectionFailure.mockClear();
    markAgentRuntimeConnectionReachable.mockClear();
    createAgentRuntimeClientForConnection.mockClear();
    subscribeAgentRuntimeEventsForConnection.mockClear();
    tavernApiRequests = [];
    globalThis.fetch = (async (input, init) => {
        const request = new Request(input, init);
        const url = new URL(request.url);
        const body = request.method === 'GET' ? null : await request.json();
        tavernApiRequests.push({ body, method: request.method, path: url.pathname });

        if (url.pathname === '/api/activity') {
            return Response.json({ activities: [] });
        }

        if (url.pathname.endsWith('/activity')) {
            const record = body as {
                agent_id: string;
                metadata: Record<string, unknown>;
                run_id: string;
                status: string;
                steps?: unknown[];
                summary?: string | null;
            };
            return Response.json({
                agent_id: record.agent_id,
                chat_id: tavernChatId,
                metadata: record.metadata,
                run_id: record.run_id,
                status: record.status,
                steps: record.steps ?? [],
                summary: record.summary ?? null,
                updated_at: '2026-05-12T19:00:01.000Z',
            });
        }

        if (url.pathname.endsWith('/deliveries')) {
            const record = body as {
                id: string;
                message: { content: string; id: string; metadata: Record<string, unknown> };
            };
            return Response.json({
                cursor: '2',
                id: record.id,
                idempotent: false,
                message: {
                    author: {
                        id: 'agent:test',
                        kind: 'agent',
                        label: null,
                        metadata: {},
                    },
                    attachment: null,
                    chat_id: tavernChatId,
                    content: record.message.content,
                    created_at: '2026-05-12T19:00:02.000Z',
                    deleted_at: null,
                    delivery_id: record.id,
                    id: record.message.id,
                    metadata: record.message.metadata,
                    nonce: null,
                    parent_message_id: null,
                    role: 'assistant',
                    sequence: 2,
                    thread_root_id: null,
                },
            });
        }

        return Response.json({
            created_at: '2026-05-12T19:00:00.000Z',
            id: tavernChatId,
            last_message_sequence: 1,
            metadata: {},
            title: null,
            updated_at: '2026-05-12T19:00:00.000Z',
        });
    }) as typeof fetch;
});

afterEach(() => {
    globalThis.fetch = originalFetch;
    databaseClient.exec('DELETE FROM agent_runtime_connections;');
    mock.restore();
});

test('startAgentRuntimeEventSync refreshes connection state when the stream connects', async () => {
    startAgentRuntimeEventSync();
    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(subscribeAgentRuntimeEventsForConnection).toHaveBeenCalledTimes(1);
    expect(markAgentRuntimeConnectionReachable).toHaveBeenCalledWith({
        connectionId: 'runtime-1',
    });
    expect(emitAgentRuntimeUpdated).toHaveBeenCalledTimes(1);
    expect(confirmAgentRuntimeConnection).toHaveBeenCalledWith({ refreshCapabilities: false });
});

test('applyObservedAgentRuntimeEvent refreshes gateway capability update events', async () => {
    await applyObservedAgentRuntimeEvent(
        {
            capability: 'gateway',
            timestamp: '2026-05-12T19:00:00.000Z',
            type: 'capability.updated',
        },
        {
            baseUrl: 'http://runtime.test',
            id: 'runtime-1',
        } as never
    );
    await flushAsyncEventSync();

    expect(refreshOpenClawGatewayCapability).toHaveBeenCalledWith('runtime-1');
    expect(emitAgentRuntimeUpdated).toHaveBeenCalledTimes(1);
});

test('applyObservedAgentRuntimeEvent forwards completed turns without fetching session history', async () => {
    const listSessions = mock(async () => ({
        sessions: [
            {
                agentId: 'agent:test',
                chatId: tavernChatId,
                key: 'session-1',
                lastActivityAt: '2026-05-12T19:00:02.000Z',
                messageCount: 1,
                parentSessionKey: null,
                platform: 'tavern',
                sessionId: 'session-1',
                sessionRole: 'main' as const,
                startedAt: '2026-05-12T19:00:00.000Z',
                title: 'Test',
            },
        ],
    }));
    const listSessionMessages = mock(async () => ({
        messages: [
            {
                agentId: 'agent:test',
                attachments: [],
                chatId: tavernChatId,
                content: 'Done.',
                id: 'assistant-message-1',
                metadata: {},
                participant: null,
                sender: 'agent:test',
                senderName: 'Agent',
                senderType: 'agent' as const,
                sessionKey: 'session-1',
                timestamp: '2026-05-12T19:00:02.000Z',
            },
        ],
    }));
    const client = { listSessionMessages, listSessions };
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
            baseUrl: 'http://runtime.test',
            id: 'runtime-1',
        } as never
    );
    await flushAsyncEventSync();

    expect(listSessions).not.toHaveBeenCalled();
    expect(listSessionMessages).not.toHaveBeenCalled();
    expect(tavernApiRequests).toEqual([]);
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
    const listSessionMessages = mock(async () => ({ messages: [] }));
    const listSessions = mock(async () => ({ sessions: [] }));
    const client = { listSessionMessages, listSessions };
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
            baseUrl: 'http://runtime.test',
            id: 'runtime-1',
        } as never
    );
    await Promise.resolve();

    expect(createAgentRuntimeClientForConnection).not.toHaveBeenCalled();
    expect(listSessions).not.toHaveBeenCalled();
    expect(listSessionMessages).not.toHaveBeenCalled();
    expect(tavernApiRequests).toEqual([]);
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
    const listSessions = mock(async () => ({
        sessions: [
            {
                agentId: 'agent:test',
                chatId: tavernChatId,
                key: 'session-1',
                lastActivityAt: '2026-05-12T19:00:02.000Z',
                messageCount: 1,
                parentSessionKey: null,
                platform: 'tavern',
                sessionId: 'session-1',
                sessionRole: 'main' as const,
                startedAt: '2026-05-12T19:00:00.000Z',
                title: 'Test',
            },
        ],
    }));
    const listSessionMessages = mock(async () => ({
        messages: [
            {
                agentId: 'agent:test',
                attachments: [],
                chatId: tavernChatId,
                content: 'Done.',
                id: 'assistant-message-1',
                metadata: {},
                participant: null,
                sender: 'agent:test',
                senderName: 'Agent',
                senderType: 'agent' as const,
                sessionKey: 'session-1',
                timestamp: '2026-05-12T19:00:02.000Z',
            },
        ],
    }));
    const client = { listSessionMessages, listSessions };
    createAgentRuntimeClientForConnection.mockReturnValue(client as never);
    const connection = {
        baseUrl: 'http://runtime.test',
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
    expect(listSessions).not.toHaveBeenCalled();
    expect(listSessionMessages).not.toHaveBeenCalled();
    expect(emitWorkersUpdated).toHaveBeenCalledTimes(1);
    expect(emitSessionUpdated).not.toHaveBeenCalled();

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

    expect(listSessions).not.toHaveBeenCalled();
    expect(listSessionMessages).not.toHaveBeenCalled();

    createAgentRuntimeClientForConnection.mockClear();
    listSessions.mockClear();
    listSessionMessages.mockClear();

    await applyObservedAgentRuntimeEvent(
        {
            sessionKey: 'session-1',
            timestamp: '2026-05-12T19:00:03.000Z',
            type: 'session.invalidated',
        },
        connection
    );
    await flushAsyncEventSync();

    expect(listSessions).not.toHaveBeenCalled();
    expect(listSessionMessages).not.toHaveBeenCalled();
});

async function flushAsyncEventSync() {
    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
}
