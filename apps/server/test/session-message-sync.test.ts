import { afterEach, test } from 'bun:test';
import assert from 'node:assert/strict';
import { ensureDatabaseSchema } from '../src/db/bootstrap.ts';
import { databaseClient } from '../src/db/index.ts';
import { getParticipant } from '../src/storage/participants.ts';
import {
    getSessionMessageProjectionState,
    listSessionMessagesForSessionKeys,
    syncSessionMessagesForRuntime,
} from '../src/storage/session-messages.ts';
import { syncSessionToolCallsForRuntime } from '../src/storage/session-tool-call-sync.ts';
import { listProjectedSessionToolCalls } from '../src/storage/session-tool-calls.ts';
import { resolveSessionMessageSyncLimit } from '../src/sync/agent-runtime-projections.ts';

ensureDatabaseSchema();

afterEach(() => {
    databaseClient.exec('DELETE FROM session_tool_calls;');
    databaseClient.exec('DELETE FROM session_messages;');
    databaseClient.exec('DELETE FROM profile_participants;');
    databaseClient.exec('DELETE FROM participant_labels;');
    databaseClient.exec('DELETE FROM participants;');
    databaseClient.exec('DELETE FROM profiles;');
});

test('session tool call sync projects durable graph timings', async () => {
    await syncSessionToolCallsForRuntime({
        runtimeId: 'runtime-1',
        runtimeSessionKeys: ['session-1'],
        syncedAt: '2026-05-02T02:00:00.000Z',
        toolCalls: [
            {
                arguments: {
                    path: 'README.md',
                },
                childSessionKey: null,
                finishedAt: '2026-05-02T01:03:02.000Z',
                id: 'tool-record-1',
                isError: false,
                messageId: 'tool-call-message',
                result: {
                    path: 'README.md',
                    status: 'ok',
                },
                sessionKey: 'session-1',
                startedAt: '2026-05-02T01:03:00.000Z',
                toolCallId: 'call-1',
                toolName: 'read',
            },
        ],
    });

    const [toolCall] = await listProjectedSessionToolCalls(['session-1']);

    assert.equal(toolCall?.toolCallId, 'call-1');
    assert.equal(toolCall?.startedAt, '2026-05-02T01:03:00.000Z');
    assert.equal(toolCall?.finishedAt, '2026-05-02T01:03:02.000Z');
    assert.deepEqual(toolCall?.arguments, { path: 'README.md' });
    assert.deepEqual(toolCall?.result, { path: 'README.md', status: 'ok' });
});

test('session message sync upserts by stable id without deleting absent partial-history rows', async () => {
    insertMessage({
        id: 'old',
        sessionKey: 'session-1',
        text: 'outside fetched window',
        timestamp: '2026-05-02T00:00:00.000Z',
    });
    insertMessage({
        id: 'stale',
        sessionKey: 'session-1',
        text: 'same window but absent from partial history',
        timestamp: '2026-05-02T01:04:00.000Z',
    });
    insertMessage({
        id: 'keep',
        sessionKey: 'session-1',
        text: 'old content',
        timestamp: '2026-05-02T01:03:00.000Z',
    });

    const result = await syncSessionMessagesForRuntime({
        messagesBySessionKey: new Map([
            [
                'session-1',
                [
                    {
                        agentId: null,
                        chatId: 'chat-1',
                        content: 'new content',
                        id: 'keep',
                        metadata: null,
                        sender: 'zach',
                        senderName: 'Zach',
                        senderType: 'user',
                        sessionKey: 'session-1',
                        timestamp: '2026-05-02T01:03:00.000Z',
                    },
                    {
                        agentId: 'main',
                        chatId: 'chat-1',
                        content: 'fresh reply',
                        id: 'fresh',
                        metadata: null,
                        sender: 'blippy',
                        senderName: 'Blippy',
                        senderType: 'agent',
                        sessionKey: 'session-1',
                        timestamp: '2026-05-02T01:05:00.000Z',
                    },
                ],
            ],
        ]),
        runtimeId: 'runtime-1',
        syncedAt: '2026-05-02T02:00:00.000Z',
    });

    const messages = await listSessionMessagesForSessionKeys(['session-1']);

    assert.equal(result.synced, 2);
    assert.equal(result.deleted, 0);
    assert.deepEqual(
        messages.map((message) => [message.id, message.contentText]),
        [
            ['old', 'outside fetched window'],
            ['keep', 'new content'],
            ['stale', 'same window but absent from partial history'],
            ['fresh', 'fresh reply'],
        ]
    );
});

test('session message projection state tracks whether a session has synced messages', async () => {
    assert.deepEqual(await getSessionMessageProjectionState('session-1'), {
        hasMessages: false,
        lastSyncedAt: null,
    });

    insertMessage({
        id: 'message-1',
        sessionKey: 'session-1',
        syncedAt: '2026-05-02T02:00:00.000Z',
        text: 'hello',
        timestamp: '2026-05-02T01:00:00.000Z',
    });

    assert.deepEqual(await getSessionMessageProjectionState('session-1'), {
        hasMessages: true,
        lastSyncedAt: '2026-05-02T02:00:00.000Z',
    });
});

test('session message sync resolves observed user senders to participants', async () => {
    await syncSessionMessagesForRuntime({
        messagesBySessionKey: new Map([
            [
                'agent:blippy:main',
                [
                    {
                        agentId: null,
                        chatId: 'discord:agent:blippy:dm:user:778786269458464829',
                        content: 'Hello Blippy!',
                        id: 'message-1',
                        metadata: null,
                        participant: {
                            accountKey: null,
                            externalId: '778786269458464829',
                            name: 'Zach Knickerbocker',
                            observedLabels: [
                                'Zach Knickerbocker',
                                'Zach Knickerbocker (778786269458464829)',
                            ],
                            participantId: 'participant:discord:global:external:778786269458464829',
                            platform: 'discord',
                            type: 'participant',
                        },
                        sender: 'user',
                        senderName: 'Zach Knickerbocker (778786269458464829)',
                        senderType: 'user',
                        sessionKey: 'agent:blippy:main',
                        timestamp: '2026-05-02T20:45:27.254Z',
                    },
                ],
            ],
        ]),
        runtimeId: 'runtime-1',
        syncedAt: '2026-05-02T21:00:00.000Z',
    });

    const [message] = await listSessionMessagesForSessionKeys(['agent:blippy:main']);
    const participant = await getParticipant(
        'participant:discord:global:external:778786269458464829'
    );

    assert.equal(message?.actorKind, 'participant');
    assert.equal(message?.actorId, 'participant:discord:global:external:778786269458464829');
    assert.deepEqual(participant?.labels, ['Zach Knickerbocker']);
});

test('message sync limit uses deeper reads for empty or stale projections', () => {
    const now = '2026-05-02T12:00:00.000Z';

    assert.equal(
        resolveSessionMessageSyncLimit({
            now,
            projectionState: { hasMessages: false, lastSyncedAt: null },
        }),
        1000
    );
    assert.equal(
        resolveSessionMessageSyncLimit({
            now,
            projectionState: {
                hasMessages: true,
                lastSyncedAt: '2026-05-02T11:59:00.000Z',
            },
        }),
        200
    );
    assert.equal(
        resolveSessionMessageSyncLimit({
            now,
            projectionState: {
                hasMessages: true,
                lastSyncedAt: '2026-05-02T00:00:00.000Z',
            },
        }),
        1000
    );
});

function insertMessage(input: {
    id: string;
    sessionKey: string;
    syncedAt?: string;
    text: string;
    timestamp: string;
}) {
    databaseClient
        .prepare(
            `INSERT INTO session_messages (
                id, session_key, seq, role, content_text, raw_json, synced_at, timestamp
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
            input.id,
            input.sessionKey,
            0,
            'user',
            input.text,
            JSON.stringify({ id: input.id }),
            input.syncedAt ?? '2026-05-02T01:30:00.000Z',
            input.timestamp
        );
}
