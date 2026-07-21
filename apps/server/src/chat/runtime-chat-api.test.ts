import assert from 'node:assert/strict';
import test from 'node:test';
import type { TavernChatMessage, TavernChatResponse, TavernResponseActivity } from '@tavern/sdk';
import {
    activityToChatRows,
    cancelledResponseToChatRow,
    failedTurnsFromResponses,
    isTimelineActivityRow,
    mapResponseIdsByMessageId,
    settledRunIdsFromResponses,
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

function activityRow(input: {
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
        id: 'act_1',
        kind: 'custom',
        metadata: input.metadata,
        response_id: 'rsp_1',
        sequence: 1,
        started_at: '2026-06-12T12:00:00.000Z',
        status: input.status,
        summary: null,
        title: input.title ?? 'activity',
        updated_at: '2026-06-12T12:00:01.000Z',
    };
}

test('an agent seat with a newer response supersedes its own failure', () => {
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

    assert.deepEqual(failedTurnsFromResponses([failed, completed]), []);
});

test('a failed seat returns a failed turn', () => {
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

    assert.deepEqual(failedTurnsFromResponses([failed]), [
        {
            error: 'Agent failed to produce a reply.',
            responseId: 'response-failed',
            turn: {
                agentId: 'agent-main',
                chatId: 'chat-1',
                runId: 'run-failed',
                sessionKey: 'session-failed',
                startedAt: '2026-06-08T12:00:00.000Z',
            },
        },
    ]);
});

test("another agent's newer response does not hide a failed seat", () => {
    const failed = response({
        id: 'response-failed',
        status: 'failed',
        updatedAt: '2026-06-08T12:00:00.000Z',
    });
    const otherAgentCompleted = {
        ...response({
            id: 'response-other',
            responseMessageId: 'message-other',
            status: 'completed',
            updatedAt: '2026-06-08T12:01:00.000Z',
        }),
        participant_id: 'agt_other',
    };

    const failures = failedTurnsFromResponses([failed, otherAgentCompleted]);

    assert.equal(failures.length, 1);
    assert.equal(failures[0]?.responseId, 'response-failed');
});

test('the timeline keeps conversation units and routes execution to evidence', () => {
    const running = response({
        id: 'response-live',
        metadata: { runtime: { agentId: 'agt_primary', runId: 'run_live' } },
        status: 'running',
        updatedAt: '2026-06-08T12:01:00.000Z',
    });
    const responsesById = new Map([[running.id, running]]);
    const buildRows = (activity: TavernResponseActivity) =>
        activityToChatRows(activity, responsesById, new Map(), new Map());
    const timelineKinds = (activity: TavernResponseActivity) =>
        buildRows(activity)
            .filter(isTimelineActivityRow)
            .map((row) => row.kind);

    // Execution evidence never reaches the timeline.
    assert.deepEqual(timelineKinds(activity({ id: 'act_tool', kind: 'tool_call' })), []);
    assert.deepEqual(timelineKinds(activity({ id: 'act_think', kind: 'reasoning' })), []);

    // The changed-files summary is contribution outcome: its chip rides the
    // timeline while the file contents stay turn evidence.
    assert.deepEqual(
        timelineKinds(
            activity({
                id: 'act_files',
                kind: 'tool_call',
                metadata: {
                    tool: {
                        arguments: { changes: [], runId: 'run_live', truncated: false },
                        name: 'workspace_changes',
                    },
                    toolName: 'workspace_changes',
                },
            })
        ),
        ['tool']
    );
    assert.deepEqual(
        timelineKinds(activity({ detail: 'Narrating...', id: 'act_msg', kind: 'message' })),
        []
    );

    // Conversation units stay: the widget is part of the contribution and it
    // carries turn identity as a field.
    const widgetRows = buildRows(
        activity({
            id: 'act_widget',
            kind: 'widget',
            metadata: { widget: { component: 'table', fallback: { text: 'Table' } } },
        })
    ).filter(isTimelineActivityRow);
    assert.deepEqual(
        widgetRows.map((row) => ({ kind: row.kind, runId: 'runId' in row ? row.runId : null })),
        [{ kind: 'widget', runId: 'run_live' }]
    );

    // The evidence set (unfiltered) keeps the execution record.
    assert.deepEqual(
        buildRows(activity({ id: 'act_tool', kind: 'tool_call' })).map((row) => row.kind),
        ['tool']
    );
});

function activity(input: {
    detail?: string;
    id: string;
    kind: TavernResponseActivity['kind'];
    metadata?: Record<string, unknown>;
}): TavernResponseActivity {
    return {
        artifact_ids: [],
        chat_id: 'chat-1',
        completed_at: '2026-06-08T12:01:00.000Z',
        detail: input.detail ?? null,
        id: input.id,
        kind: input.kind,
        metadata: {
            runtime: { agentId: 'agt_primary', runId: 'run_live' },
            ...(input.metadata ?? {}),
        },
        response_id: 'response-live',
        sequence: 1,
        started_at: '2026-06-08T12:00:30.000Z',
        status: 'completed',
        summary: input.detail ?? input.id,
        title: input.id,
        updated_at: '2026-06-08T12:01:00.000Z',
    } as TavernResponseActivity;
}

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

test('cancelled historical command response stays out of the stopped system row lane', () => {
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
                ...activityRow({ detail: 'live', metadata: {}, status: 'completed' }),
                response_id: 'rsp_live',
            },
            {
                ...activityRow({ detail: 'gone', metadata: {}, status: 'completed' }),
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
        ['act_1']
    );
    // The dismissed failed response no longer drives the failure banner.
    assert.deepEqual(failedTurnsFromResponses(visible.responses), []);
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
        role: 'user',
        sequence: 1,
    } as TavernChatMessage;
}

test('settled run ids cover terminal responses with run identity only', () => {
    const silentCompleted = response({
        id: 'rsp_silent',
        metadata: { runtime: { runId: 'run-silent' } },
        status: 'completed',
        updatedAt: '2026-06-08T12:00:01.000Z',
    });
    const running = response({
        id: 'rsp_running',
        metadata: { runtime: { runId: 'run-live' } },
        status: 'running',
        updatedAt: '2026-06-08T12:00:02.000Z',
    });
    const cancelled = response({
        id: 'rsp_cancelled',
        metadata: { runtime: { runId: 'run-cancelled' } },
        status: 'cancelled',
        updatedAt: '2026-06-08T12:00:03.000Z',
    });
    // Session resets and other non-turn evidence carry no run identity and
    // must not leak into the settlement signal.
    const sessionReset = response({
        id: 'rsp_session_reset',
        metadata: { runtime: { source: 'session-reset' } },
        status: 'completed',
        updatedAt: '2026-06-08T12:00:04.000Z',
    });

    assert.deepEqual(
        settledRunIdsFromResponses([silentCompleted, running, cancelled, sessionReset]),
        ['run-silent', 'run-cancelled']
    );
});

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
