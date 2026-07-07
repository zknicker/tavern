import { afterEach, mock, spyOn, test } from 'bun:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.DATABASE_PATH = join(
    mkdtempSync(join(tmpdir(), 'tavern-session-agent-runtime-test-')),
    'test.sqlite'
);

const [
    agentRuntimeClientFactory,
    agentRuntimeClient,
    { ensureDatabaseSchema },
    { databaseClient, db },
    { sessionArtifactsTable, sessionLinksTable },
    { getSessionDetail },
    { getSessionHistory },
    { listSessionSummaries },
    { getSessionLogPage },
    { getSessionPrompt },
    { resyncSession },
    { getSessionToolCall },
    { saveAgentRuntimeConnection },
    { syncAgentsForRuntime },
    { syncSessionMessagesForRuntime },
    { listSessionRecords, parseSessionRecord, syncSessionsForRuntime },
] = await Promise.all([
    import('../src/agent-runtime/client-factory.ts'),
    import('../src/agent-runtime/configured-client.ts'),
    import('../src/db/bootstrap.ts'),
    import('../src/db/index.ts'),
    import('../src/db/schema.ts'),
    import('../src/sessions/detail.ts'),
    import('../src/sessions/history.ts'),
    import('../src/sessions/list.ts'),
    import('../src/sessions/log-page.ts'),
    import('../src/sessions/prompt.ts'),
    import('../src/sessions/resync.ts'),
    import('../src/sessions/tool-call.ts'),
    import('../src/storage/agent-runtime-connections.ts'),
    import('../src/storage/agents.ts'),
    import('../src/storage/session-messages.ts'),
    import('../src/storage/sessions.ts'),
]);

await ensureDatabaseSchema();

const originalFetch = globalThis.fetch;

afterEach(() => {
    mock.restore();
    globalThis.fetch = originalFetch;
    databaseClient.exec(
        'DELETE FROM session_artifacts; DELETE FROM session_links; DELETE FROM session_messages; DELETE FROM session_tool_calls; DELETE FROM session_runs; DELETE FROM agents; DELETE FROM agent_runtime_connections;'
    );
});

function mockRuntimeChatFetch(chats = [runtimeTavernChat()]) {
    globalThis.fetch = async (input) => {
        const url = new URL(input instanceof Request ? input.url : String(input));

        if (url.pathname === '/agents') {
            return Response.json({
                agents: [
                    {
                        enabledSkillIds: [],
                        id: 'support',
                        isAdmin: false,
                        name: 'Support',
                        primaryColor: null,
                        workspaceFolder: 'support',
                    },
                ],
            });
        }

        if (url.pathname === '/api/chats') {
            return Response.json({
                chats,
                next_cursor: null,
            });
        }

        if (url.pathname === '/agent/chats') {
            return Response.json({ chats: [] });
        }

        if (url.pathname === '/agent/sessions') {
            return Response.json({
                sessions: (await listSessionRecords()).flatMap((record) => {
                    const session = parseSessionRecord(record);
                    return session ? [session] : [];
                }),
            });
        }

        return new Response('Not found', { status: 404 });
    };
}

function runtimeTavernChat() {
    return {
        created_at: '2026-04-15T21:27:15.953Z',
        id: 'chat-support',
        kind: 'channel',
        metadata: {
            runtime: {
                source: 'tavern',
            },
            tavern: {
                agentIds: ['support'],
                archived: false,
                displayName: 'Support Chat',
            },
        },
        participants: [
            {
                id: 'profile:self',
                joined_at: '2026-04-15T21:27:15.953Z',
                kind: 'human',
                label: 'User',
            },
            {
                id: 'support',
                joined_at: '2026-04-15T21:27:15.953Z',
                kind: 'agent',
                label: 'Support',
            },
        ],
        title: 'Support Chat',
        updated_at: '2026-04-15T21:28:10.000Z',
    };
}

test('session queries read bounded runtime session history', async () => {
    mockRuntimeChatFetch();
    spyOn(agentRuntimeClient, 'createConfiguredAgentRuntimeClient').mockReturnValue({
        close: () => {},
        listSessionMessages: async (_sessionKey: string) => ({
            messages: [
                {
                    agentId: null,
                    chatId: 'chat-support',
                    content: 'You are Support.\n## Soul\nBe precise and calm.',
                    id: 'chat-support::support:system-prompt',
                    metadata: null,
                    sender: 'system-prompt',
                    senderName: 'System Prompt',
                    senderType: 'system',
                    sessionKey: 'chat-support::support',
                    timestamp: '2026-04-15T21:27:15.953Z',
                },
                {
                    agentId: null,
                    chatId: 'chat-support',
                    content: 'Find the incident summary.',
                    id: 'message-user',
                    metadata: null,
                    sender: 'user',
                    senderName: 'User',
                    senderType: 'user',
                    sessionKey: 'chat-support::support',
                    timestamp: '2026-04-15T21:27:20.000Z',
                },
                {
                    agentId: 'support',
                    chatId: 'chat-support',
                    content: '',
                    id: 'message-tool-call',
                    metadata: {
                        model: 'claude-sonnet-4-6',
                        parts: [
                            {
                                id: 'tool-call-1',
                                name: 'Agent',
                                arguments: {
                                    prompt: 'Research the incident timeline.',
                                },
                                type: 'toolCall',
                            },
                            {
                                text: 'Need a focused worker for this.',
                                type: 'thinking',
                            },
                        ],
                        provider: 'claude',
                        toolCallId: 'tool-call-1',
                        toolName: 'Agent',
                    },
                    sender: 'support',
                    senderName: 'Support',
                    senderType: 'agent',
                    sessionKey: 'chat-support::support',
                    timestamp: '2026-04-15T21:27:30.000Z',
                },
                {
                    agentId: null,
                    chatId: 'chat-support',
                    content:
                        '{"childSessionKey":"chat-support::support::worker:research","status":"completed"}',
                    id: 'message-tool-result',
                    metadata: {
                        toolCallId: 'tool-call-1',
                        toolName: 'Agent',
                    },
                    sender: 'tool',
                    senderName: 'ToolResult',
                    senderType: 'system',
                    sessionKey: 'chat-support::support',
                    timestamp: '2026-04-15T21:28:00.000Z',
                },
                {
                    agentId: 'support',
                    chatId: 'chat-support',
                    content: 'The worker finished the timeline summary.',
                    id: 'message-final',
                    metadata: null,
                    sender: 'support',
                    senderName: 'Support',
                    senderType: 'agent',
                    sessionKey: 'chat-support::support',
                    timestamp: '2026-04-15T21:28:10.000Z',
                },
            ],
        }),
        getSessionGraph: async () => ({
            artifacts: [
                {
                    artifactType: 'system-prompt',
                    createdAt: '2026-04-15T21:27:15.953Z',
                    id: 'artifact-prompt',
                    messageId: 'chat-support::support:system-prompt',
                    mimeType: 'text/markdown',
                    path: '/tmp/session-prompts/session-root.md',
                    payload: null,
                    runId: null,
                    sessionKey: 'chat-support::support',
                    toolCallId: null,
                },
            ],
            links: [
                {
                    childSessionKey: 'chat-support::support::worker:research',
                    createdAt: '2026-04-15T21:28:00.000Z',
                    id: 'link-worker',
                    linkType: 'worker',
                    parentSessionKey: 'chat-support::support',
                    sourceToolCallId: 'tool-call-1',
                },
            ],
            messages: [
                {
                    agentId: null,
                    chatId: 'chat-support',
                    content: 'You are Support.\n## Soul\nBe precise and calm.',
                    id: 'chat-support::support:system-prompt',
                    metadata: null,
                    sender: 'system-prompt',
                    senderName: 'System Prompt',
                    senderType: 'system',
                    sessionKey: 'chat-support::support',
                    timestamp: '2026-04-15T21:27:15.953Z',
                },
                {
                    agentId: null,
                    chatId: 'chat-support',
                    content: 'Find the incident summary.',
                    id: 'message-user',
                    metadata: null,
                    sender: 'user',
                    senderName: 'User',
                    senderType: 'user',
                    sessionKey: 'chat-support::support',
                    timestamp: '2026-04-15T21:27:20.000Z',
                },
                {
                    agentId: 'support',
                    chatId: 'chat-support',
                    content: '',
                    id: 'message-tool-call',
                    metadata: {
                        model: 'claude-sonnet-4-6',
                        parts: [
                            {
                                id: 'tool-call-1',
                                name: 'Agent',
                                arguments: {
                                    prompt: 'Research the incident timeline.',
                                },
                                type: 'toolCall',
                            },
                            {
                                text: 'Need a focused worker for this.',
                                type: 'thinking',
                            },
                        ],
                        provider: 'claude',
                        toolCallId: 'tool-call-1',
                        toolName: 'Agent',
                    },
                    sender: 'support',
                    senderName: 'Support',
                    senderType: 'agent',
                    sessionKey: 'chat-support::support',
                    timestamp: '2026-04-15T21:27:30.000Z',
                },
                {
                    agentId: null,
                    chatId: 'chat-support',
                    content:
                        '{"childSessionKey":"chat-support::support::worker:research","status":"completed"}',
                    id: 'message-tool-result',
                    metadata: {
                        toolCallId: 'tool-call-1',
                        toolName: 'Agent',
                    },
                    sender: 'tool',
                    senderName: 'ToolResult',
                    senderType: 'system',
                    sessionKey: 'chat-support::support',
                    timestamp: '2026-04-15T21:28:00.000Z',
                },
                {
                    agentId: 'support',
                    chatId: 'chat-support',
                    content: 'The worker finished the timeline summary.',
                    id: 'message-final',
                    metadata: null,
                    sender: 'support',
                    senderName: 'Support',
                    senderType: 'agent',
                    sessionKey: 'chat-support::support',
                    timestamp: '2026-04-15T21:28:10.000Z',
                },
                {
                    agentId: null,
                    chatId: 'chat-support',
                    content: 'Research the incident timeline.',
                    id: 'worker-user',
                    metadata: null,
                    sender: 'user',
                    senderName: 'User',
                    senderType: 'user',
                    sessionKey: 'chat-support::support::worker:research',
                    timestamp: '2026-04-15T21:28:01.000Z',
                },
                {
                    agentId: 'support',
                    chatId: 'chat-support',
                    content: 'Timeline assembled.',
                    id: 'worker-final',
                    metadata: null,
                    sender: 'support',
                    senderName: 'Support',
                    senderType: 'agent',
                    sessionKey: 'chat-support::support::worker:research',
                    timestamp: '2026-04-15T21:28:05.000Z',
                },
            ],
            rootSessionKey: 'chat-support::support',
            sessions: [
                {
                    agentId: 'support',
                    chatId: 'chat-support',
                    key: 'chat-support::support',
                    lastActivityAt: '2026-04-15T21:28:10.000Z',
                    messageCount: 5,
                    parentSessionKey: null,
                    platform: 'tavern',
                    sessionId: 'session-root',
                    sessionRole: 'main',
                    startedAt: '2026-04-15T21:27:15.953Z',
                    title: 'Support Chat',
                },
                {
                    agentId: 'support',
                    chatId: 'chat-support',
                    key: 'chat-support::support::worker:research',
                    lastActivityAt: '2026-04-15T21:28:05.000Z',
                    messageCount: 2,
                    parentSessionKey: 'chat-support::support',
                    platform: 'tavern',
                    sessionId: 'session-worker',
                    sessionRole: 'worker',
                    startedAt: '2026-04-15T21:28:01.000Z',
                    title: 'Research worker',
                },
            ],
            toolCalls: [
                {
                    arguments: {
                        prompt: 'Research the incident timeline.',
                    },
                    childSessionKey: 'chat-support::support::worker:research',
                    finishedAt: '2026-04-15T21:28:00.000Z',
                    id: 'tool-record-1',
                    isError: false,
                    messageId: 'message-tool-call',
                    result: {
                        childSessionKey: 'chat-support::support::worker:research',
                        status: 'completed',
                    },
                    sessionKey: 'chat-support::support',
                    startedAt: '2026-04-15T21:27:30.000Z',
                    toolCallId: 'tool-call-1',
                    toolName: 'Agent',
                },
            ],
        }),
        listAgents: async () => ({
            agents: [
                {
                    enabledSkillIds: [],
                    id: 'support',
                    isAdmin: false,
                    name: 'Support',
                    primaryColor: null,
                    workspaceFolder: 'support',
                },
            ],
        }),
        listChats: async () => ({
            chats: [
                {
                    activeTurnParticipantIds: [],
                    bindingId: null,
                    bindings: [{ agentId: 'support' }],
                    id: 'chat-support',
                    inboundMode: 'active',
                    metadata: { tavern: { displayName: 'Support Chat' } },
                    name: 'Support Chat',
                    parentTarget: null,
                    participants: [{ agentId: 'support', type: 'agent' }],
                    platform: 'tavern',
                    platformMetadata: null,
                    requiresTrigger: false,
                    scope: null,
                    target: 'support',
                    trigger: null,
                    workspaceFolder: 'support-chat',
                },
            ],
        }),
        listSessions: async () => ({
            sessions: [
                {
                    agentId: 'support',
                    chatId: 'chat-support',
                    key: 'chat-support::support',
                    lastActivityAt: '2026-04-15T21:28:10.000Z',
                    messageCount: 5,
                    parentSessionKey: null,
                    platform: 'tavern',
                    sessionId: 'session-root',
                    sessionRole: 'main',
                    startedAt: '2026-04-15T21:27:15.953Z',
                    title: 'Support Chat',
                },
                {
                    agentId: 'support',
                    chatId: 'chat-support',
                    key: 'chat-support::support::worker:research',
                    lastActivityAt: '2026-04-15T21:28:05.000Z',
                    messageCount: 2,
                    parentSessionKey: 'chat-support::support',
                    platform: 'tavern',
                    sessionId: 'session-worker',
                    sessionRole: 'worker',
                    startedAt: '2026-04-15T21:28:01.000Z',
                    title: 'Research worker',
                },
            ],
        }),
        resyncSession: async (sessionKey: string) => ({
            resynced: true,
            rootSessionKey: 'chat-support::support',
            sessionKey,
        }),
    } as never);
    spyOn(agentRuntimeClientFactory, 'createAgentRuntimeClientForConnection').mockReturnValue({
        close: () => {},
        listAgents: async () => ({
            agents: [
                {
                    enabledSkillIds: [],
                    id: 'support',
                    isAdmin: false,
                    name: 'Support',
                    primaryColor: null,
                    workspaceFolder: 'support',
                },
            ],
        }),
        listChats: async () => ({ chats: [] }),
        listSessionMessages: async (_sessionKey: string) => ({
            messages: [
                {
                    agentId: null,
                    chatId: 'chat-support',
                    content: 'Find the incident summary.',
                    id: 'message-user',
                    metadata: null,
                    sender: 'user',
                    senderName: 'User',
                    senderType: 'user',
                    sessionKey: 'chat-support::support',
                    timestamp: '2026-04-15T21:27:20.000Z',
                },
            ],
        }),
        listSessions: async () => ({
            sessions: [
                {
                    agentId: 'support',
                    chatId: 'chat-support',
                    key: 'chat-support::support',
                    lastActivityAt: '2026-04-15T21:28:10.000Z',
                    messageCount: 5,
                    parentSessionKey: null,
                    platform: 'tavern',
                    sessionId: 'session-root',
                    sessionRole: 'main',
                    startedAt: '2026-04-15T21:27:15.953Z',
                    title: 'Support Chat',
                },
            ],
        }),
        resyncSession: async (sessionKey: string) => ({
            resynced: true,
            rootSessionKey: 'chat-support::support',
            sessionKey,
        }),
    } as never);
    await saveAgentRuntimeConnection({
        baseUrl: 'http://agent-runtime.test',
        id: 'runtime-1',
        lastCheckedAt: null,
        lastError: null,
        name: 'Agent Runtime',
    });
    await syncAgentsForRuntime({
        agents: [
            {
                enabledSkillIds: [],
                id: 'support',
                isAdmin: false,
                name: 'Support',
                primaryColor: null,
                workspaceFolder: 'support',
            },
        ],
        runtimeId: 'runtime-1',
    });
    await syncSessionsForRuntime({
        runtimeId: 'runtime-1',
        sessions: [
            {
                agentId: 'support',
                chatId: 'chat-support',
                key: 'chat-support::support',
                lastActivityAt: '2026-04-15T21:28:10.000Z',
                messageCount: 5,
                parentSessionKey: null,
                platform: 'tavern',
                sessionId: 'session-root',
                sessionRole: 'main',
                startedAt: '2026-04-15T21:27:15.953Z',
                title: 'Support Chat',
            },
            {
                agentId: 'support',
                chatId: 'chat-support',
                key: 'chat-support::support::worker:research',
                lastActivityAt: '2026-04-15T21:28:05.000Z',
                messageCount: 2,
                parentSessionKey: 'chat-support::support',
                platform: 'tavern',
                sessionId: 'session-worker',
                sessionRole: 'worker',
                startedAt: '2026-04-15T21:28:01.000Z',
                title: 'Research worker',
            },
        ],
    });
    const graph = await agentRuntimeClient
        .createConfiguredAgentRuntimeClient()
        .getSessionGraph('chat-support::support');
    const sessionKey = 'chat-support::support';
    const childSessionKey = 'chat-support::support::worker:research';

    await syncSessionMessagesForRuntime({
        messagesBySessionKey: new Map(
            graph.sessions.map((session) => [
                session.key,
                graph.messages.filter((message) => message.sessionKey === session.key),
            ])
        ),
        runtimeId: 'runtime-1',
    });

    if (graph.links.length > 0) {
        await db.insert(sessionLinksTable).values(
            graph.links.map((link) => ({
                childSessionKey:
                    link.childSessionKey === 'chat-support::support::worker:research'
                        ? childSessionKey
                        : link.childSessionKey,
                createdAt: link.createdAt,
                deliveryMode: null,
                id: link.id,
                linkType: link.linkType,
                parentSessionKey:
                    link.parentSessionKey === 'chat-support::support'
                        ? sessionKey
                        : link.parentSessionKey,
                payloadJson: null,
                runId: null,
                sourceMessageId: null,
                sourceToolCallId: link.sourceToolCallId,
                updatedAt: link.createdAt,
            }))
        );
    }

    if (graph.toolCalls.length > 0) {
        const insertToolCall = databaseClient.prepare(
            `INSERT INTO session_tool_calls (
                id, session_key, message_id, tool_call_id, tool_name, arguments_json,
                result_json, child_session_key, run_id, is_error, started_at, finished_at,
                updated_at, raw_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        );

        for (const toolCall of graph.toolCalls) {
            insertToolCall.run(
                toolCall.id,
                toolCall.sessionKey,
                toolCall.messageId ?? null,
                toolCall.toolCallId,
                toolCall.toolName,
                JSON.stringify(toolCall.arguments),
                JSON.stringify(toolCall.result),
                toolCall.childSessionKey,
                null,
                toolCall.isError,
                toolCall.startedAt,
                toolCall.finishedAt,
                toolCall.finishedAt ?? toolCall.startedAt ?? new Date(0).toISOString(),
                JSON.stringify(toolCall)
            );
        }
    }

    if (graph.artifacts.length > 0) {
        await db.insert(sessionArtifactsTable).values(
            graph.artifacts.map((artifact) => ({
                artifactType: artifact.artifactType,
                createdAt: artifact.createdAt,
                id: artifact.id,
                messageId: artifact.messageId ?? null,
                mimeType: artifact.mimeType,
                path: artifact.path,
                payloadJson: JSON.stringify(artifact.payload),
                runId: artifact.runId,
                sessionKey: artifact.sessionKey,
                sizeBytes: null,
                toolCallId: artifact.toolCallId,
                updatedAt: artifact.createdAt,
            }))
        );
    }

    const [summaries, detail, history, logPage, tool, resynced] = await Promise.all([
        listSessionSummaries(),
        getSessionDetail({
            limit: 20,
            offset: 0,
            sessionKey,
        }),
        getSessionHistory({
            limit: 20,
            sessionKey,
        }),
        getSessionLogPage({
            limit: 20,
            offset: 0,
            sessionKey,
        }),
        getSessionToolCall({
            sessionKey,
            toolCallId: 'tool-call-1',
        }),
        resyncSession({
            sessionKey,
        }),
    ]);

    assert.equal(summaries.length, 2);
    assert.equal(summaries[0]?.source, 'Support Chat');
    assert.equal(detail?.session.key, sessionKey);
    assert.equal(detail?.messages.total, 5);

    assert.ok(history);
    assert.ok(history.rows.some((row) => row.kind === 'system' && row.systemKind === 'thinking'));
    assert.deepEqual(
        history.rows.find((row) => row.kind === 'message' && row.message.id === 'message-user')
            ?.actor,
        {
            id: 'profile:self',
            kind: 'profile',
        }
    );
    assert.equal(
        history.rows.find((row) => row.kind === 'message' && row.message.id === 'message-user')
            ?.message.sender,
        'You'
    );

    assert.ok(logPage);
    assert.ok(logPage.entries.some((entry) => entry.kind === 'toolExecution'));

    assert.ok(tool);
    assert.equal(tool.toolCall.name, 'Agent');
    assert.equal(tool.actions[0]?.kind, 'open-session');
    assert.equal(tool.actions[0]?.sessionKey, childSessionKey);

    assert.deepEqual(resynced, {
        resynced: true,
        rootSessionKey: 'chat-support::support',
        sessionKey: 'chat-support::support',
    });
});

test('session prompt reads live runtime prompt inspection', async () => {
    spyOn(agentRuntimeClient, 'createConfiguredAgentRuntimeClient').mockReturnValue({
        close: () => {},
        getSessionPrompt: async (_sessionKey: string) => ({
            assistantName: 'Support',
            fullText: 'Base instructions\n\n---\n\n## Soul\n\nBe precise and calm.',
            generatedAt: '2026-04-28T16:00:00.000Z',
            provider: 'claude',
            sections: [
                {
                    content: 'Base instructions',
                    id: 'base:agent-runtime',
                    kind: 'base',
                    label: 'Base Instructions',
                },
                {
                    content: '## Soul\n\nBe precise and calm.',
                    id: 'identity:soul',
                    kind: 'identity',
                    label: 'Soul',
                },
            ],
        }),
        listSessions: async () => ({
            sessions: [
                {
                    agentId: 'support',
                    chatId: 'chat-support',
                    key: 'chat-support::support',
                    lastActivityAt: '2026-04-28T16:00:00.000Z',
                    messageCount: 1,
                    parentSessionKey: null,
                    platform: 'tavern',
                    sessionId: 'session-root',
                    sessionRole: 'main',
                    startedAt: '2026-04-28T16:00:00.000Z',
                    title: 'Support Chat',
                },
            ],
        }),
    } as never);
    await saveAgentRuntimeConnection({
        baseUrl: 'http://agent-runtime.test',
        id: 'runtime-1',
        lastCheckedAt: null,
        lastError: null,
        name: 'Agent Runtime',
    });
    await syncSessionsForRuntime({
        runtimeId: 'runtime-1',
        sessions: [
            {
                agentId: 'support',
                chatId: 'chat-support',
                key: 'chat-support::support',
                lastActivityAt: '2026-04-28T16:00:00.000Z',
                messageCount: 1,
                parentSessionKey: null,
                platform: 'tavern',
                sessionId: 'session-root',
                sessionRole: 'main',
                startedAt: '2026-04-28T16:00:00.000Z',
                title: 'Support Chat',
            },
        ],
    });

    const prompt = await getSessionPrompt({ sessionKey: 'chat-support::support' });

    assert.ok(prompt);
    assert.equal(prompt.provider, 'claude');
    assert.equal(prompt.assistantName, 'Support');
    assert.equal(prompt.sections[0]?.id, 'base:agent-runtime');
});

test('session summaries hydrate session id from the durable runtime column', async () => {
    mockRuntimeChatFetch();
    spyOn(agentRuntimeClient, 'createConfiguredAgentRuntimeClient').mockReturnValue({
        close: () => {},
        listSessions: async () => ({
            sessions: [
                {
                    agentId: 'support',
                    chatId: 'chat-support',
                    key: 'chat-support::support',
                    lastActivityAt: '2026-04-28T16:00:00.000Z',
                    messageCount: 1,
                    parentSessionKey: null,
                    platform: 'tavern',
                    sessionId: 'session-root',
                    sessionRole: 'main',
                    startedAt: '2026-04-28T16:00:00.000Z',
                    title: 'Support Chat',
                },
            ],
        }),
    } as never);
    await saveAgentRuntimeConnection({
        baseUrl: 'http://agent-runtime.test',
        id: 'runtime-1',
        lastCheckedAt: null,
        lastError: null,
        name: 'Agent Runtime',
    });
    await syncSessionsForRuntime({
        runtimeId: 'runtime-1',
        sessions: [
            {
                agentId: 'support',
                chatId: 'chat-support',
                key: 'chat-support::support',
                lastActivityAt: '2026-04-28T16:00:00.000Z',
                messageCount: 1,
                parentSessionKey: null,
                platform: 'tavern',
                sessionId: 'session-root',
                sessionRole: 'main',
                startedAt: '2026-04-28T16:00:00.000Z',
                title: 'Support Chat',
            },
        ],
    });
    databaseClient.exec(
        'UPDATE session_runs SET payload_json = replace(payload_json, \'"sessionId":"session-root",\', \'\')'
    );

    const summaries = await listSessionSummaries();

    assert.equal(summaries[0]?.id, 'session-root');
    assert.equal(summaries[0]?.key, 'chat-support::support');
});
