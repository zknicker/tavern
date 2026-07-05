import assert from 'node:assert/strict';
import test from 'node:test';
import type { TavernChatMessage, TavernChatResponse, TavernResponseActivity } from '@tavern/sdk';
import {
    cancelledResponseToChatRow,
    commandRunFromActivity,
    failedTurnFromResponses,
    mapResponseIdsByMessageId,
    visibleTimelineSources,
} from './runtime-chat-api.ts';

test('a reply that triggers the next turn stays attributed to its producing response', () => {
    const responses = [
        {
            ...response({
                id: 'rsp_first',
                responseMessageId: 'msg_first_reply',
                status: 'completed',
                updatedAt: '2026-06-08T12:00:01.000Z',
            }),
            request_message_id: 'message-user',
        },
        {
            ...response({
                id: 'rsp_second',
                responseMessageId: 'msg_second_reply',
                status: 'completed',
                updatedAt: '2026-06-08T12:00:02.000Z',
            }),
            // Agent-triggered turn: the previous reply is this run's request.
            request_message_id: 'msg_first_reply',
        },
    ];

    const mapping = mapResponseIdsByMessageId(responses);

    assert.equal(mapping.get('msg_first_reply'), 'rsp_first');
    assert.equal(mapping.get('msg_second_reply'), 'rsp_second');
    assert.equal(mapping.get('message-user'), 'rsp_first');
});

test('command activity with a typed slash command maps to a command run', () => {
    assert.deepEqual(
        commandRunFromActivity(
            commandActivity({
                detail: 'Model set to tavern-e2e-fake',
                metadata: { command: { status: 'completed', text: '/model sonnet' } },
                status: 'completed',
            })
        ),
        {
            command: '/model sonnet',
            output: 'Model set to tavern-e2e-fake',
            responseId: 'rsp_cmd_1',
            status: 'completed',
        }
    );
});

test('failed command activity maps to a failed command run', () => {
    assert.deepEqual(
        commandRunFromActivity(
            commandActivity({
                detail: 'slash worker start failed',
                metadata: { command: { status: 'failed', text: '/compact' } },
                status: 'failed',
            })
        ),
        {
            command: '/compact',
            output: 'slash worker start failed',
            responseId: 'rsp_cmd_1',
            status: 'failed',
        }
    );
});

test('command activity without a slash command stays out of the command-run lane', () => {
    assert.equal(
        commandRunFromActivity(
            commandActivity({
                detail: 'ls -la',
                metadata: {},
                status: 'completed',
                title: 'shell',
            })
        ),
        null
    );
});

function commandActivity(input: {
    detail: string;
    metadata: Record<string, unknown>;
    status: TavernResponseActivity['status'];
    title?: string;
}): TavernResponseActivity {
    return {
        artifact_ids: [],
        chat_id: 'chat-1',
        completed_at: '2026-06-12T12:00:01.000Z',
        detail: input.detail,
        id: 'act_cmd_1',
        kind: 'command',
        metadata: input.metadata,
        response_id: 'rsp_cmd_1',
        sequence: 1,
        started_at: '2026-06-12T12:00:00.000Z',
        status: input.status,
        summary: null,
        title: input.title ?? '/model',
        updated_at: '2026-06-12T12:00:01.000Z',
    };
}

test('failed turn only reflects the latest response', () => {
    const failed = response({
        id: 'response-failed',
        metadata: { error: 'boom' },
        status: 'failed',
        updatedAt: '2026-06-08T12:00:00.000Z',
    });
    const completed = response({
        id: 'response-completed',
        responseMessageId: 'message-completed',
        status: 'completed',
        updatedAt: '2026-06-08T12:01:00.000Z',
    });

    assert.equal(failedTurnFromResponses([failed, completed]), null);
});

test('latest failed response returns a failed turn', () => {
    const failed = response({
        id: 'response-failed',
        metadata: {
            runtime: {
                agentId: 'agent-main',
                runId: 'run-failed',
                sessionKey: 'session-failed',
                startedAt: '2026-06-08T12:00:00.000Z',
            },
        },
        status: 'failed',
        updatedAt: '2026-06-08T12:01:00.000Z',
    });

    assert.deepEqual(failedTurnFromResponses([failed]), {
        error: 'Agent failed to produce a reply.',
        responseId: 'response-failed',
        turn: {
            agentId: 'agent-main',
            chatId: 'chat-1',
            runId: 'run-failed',
            sessionKey: 'session-failed',
            startedAt: '2026-06-08T12:00:00.000Z',
        },
    });
});

test('cancelled response maps to a stopped system row', () => {
    const cancelled = response({
        id: 'response-cancelled',
        status: 'cancelled',
        summary: 'Agent response stopped.',
        updatedAt: '2026-06-08T12:01:00.000Z',
    });

    assert.deepEqual(cancelledResponseToChatRow(cancelled), [
        {
            id: 'response-cancelled:cancelled',
            kind: 'system',
            responseId: 'response-cancelled',
            systemKind: 'turnStatus',
            timestamp: '2026-06-08T12:01:00.000Z',
            turnStatus: {
                agentId: 'agt_primary',
                runId: 'response-cancelled',
                sessionKey: 'response-cancelled',
                status: 'stopped',
                text: 'Agent response stopped.',
            },
        },
    ]);
});

test('cancelled command response stays out of the stopped system row lane', () => {
    const cancelledCommand = response({
        id: 'response-cancelled-command',
        metadata: { runtime: { source: 'command' } },
        status: 'cancelled',
        updatedAt: '2026-06-08T12:01:00.000Z',
    });

    assert.deepEqual(cancelledResponseToChatRow(cancelledCommand), []);
});

test('soft-deleted rows never reach the timeline', () => {
    const liveResponse = response({
        id: 'rsp_live',
        status: 'completed',
        updatedAt: '2026-06-08T12:00:00.000Z',
    });
    const deletedResponse = {
        ...response({
            id: 'rsp_deleted',
            status: 'failed',
            updatedAt: '2026-06-08T12:01:00.000Z',
        }),
        deleted_at: '2026-06-08T12:02:00.000Z',
    };
    const visible = visibleTimelineSources({
        activity: [
            {
                ...commandActivity({ detail: 'live', metadata: {}, status: 'completed' }),
                response_id: 'rsp_live',
            },
            {
                ...commandActivity({ detail: 'gone', metadata: {}, status: 'completed' }),
                id: 'act_deleted',
                response_id: 'rsp_deleted',
            },
        ],
        artifacts: [],
        messages: [
            message({ id: 'msg_live' }),
            { ...message({ id: 'msg_deleted' }), deleted_at: '2026-06-08T12:02:00.000Z' },
        ],
        responses: [liveResponse, deletedResponse],
    });

    assert.deepEqual(
        visible.messages.map((entry) => entry.id),
        ['msg_live']
    );
    assert.deepEqual(
        visible.responses.map((entry) => entry.id),
        ['rsp_live']
    );
    assert.deepEqual(
        visible.activity.map((entry) => entry.id),
        ['act_cmd_1']
    );
    // The dismissed failed response no longer drives the failure banner.
    assert.equal(failedTurnFromResponses(visible.responses), null);
});

function message(input: { id: string }): TavernChatMessage {
    return {
        attachments: [],
        author: { id: 'usr_1', kind: 'user', label: null, metadata: {} },
        chat_id: 'chat-1',
        content: 'hello',
        created_at: '2026-06-08T12:00:00.000Z',
        deleted_at: null,
        delivery_id: null,
        id: input.id,
        metadata: {},
        nonce: null,
        parent_message_id: null,
        role: 'user',
        sequence: 1,
        thread_root_id: null,
    } as TavernChatMessage;
}

function response(input: {
    id: string;
    metadata?: Record<string, unknown>;
    responseMessageId?: string;
    status: TavernChatResponse['status'];
    summary?: string | null;
    updatedAt: string;
}): TavernChatResponse {
    return {
        chat_id: 'chat-1',
        completed_at: input.status === 'completed' ? input.updatedAt : null,
        created_at: '2026-06-08T12:00:00.000Z',
        id: input.id,
        metadata: input.metadata ?? {},
        participant_id: 'agt_primary',
        request_message_id: 'message-user',
        response_message_id: input.responseMessageId ?? null,
        status: input.status,
        summary: input.summary ?? null,
        updated_at: input.updatedAt,
    } as TavernChatResponse;
}
