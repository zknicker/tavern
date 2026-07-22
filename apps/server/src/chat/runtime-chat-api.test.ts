import assert from 'node:assert/strict';
import test from 'node:test';
import type { TavernChatMessage, TavernChatResponse } from '@tavern/sdk';
import {
    mapResponseIdsByMessageId,
    messageToChatRows,
    visibleTimelineSources,
} from './runtime-chat-api.ts';

test('system messages render as plain message rows', () => {
    const notice = {
        ...message({ id: 'msg_thread_notice' }),
        author: { id: 'sys_thread_notice', kind: 'system', label: null, metadata: {} },
        content: '@Otto unfollowed this thread — done here',
        metadata: { runtime: { agentId: 'agt_otto', source: 'thread-notice' } },
        role: 'system',
    } as TavernChatMessage;

    const rows = messageToChatRows(notice, new Map(), new Map(), new Map());

    assert.equal(rows.length, 1);
    const [row] = rows;
    assert.equal(row?.kind, 'message');
    assert.equal(row && 'message' in row ? row.message.senderType : null, 'system');
    assert.equal(
        row && 'message' in row ? row.message.content : null,
        '@Otto unfollowed this thread — done here'
    );
});

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
