import assert from 'node:assert/strict';
import test from 'node:test';
import type { TavernChatResponse } from '@tavern/sdk';
import { failedTurnFromResponses } from './runtime-chat-api.ts';

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
        error: 'Turn failed.',
        turn: {
            agentId: 'agent-main',
            chatId: 'chat-1',
            runId: 'run-failed',
            sessionKey: 'session-failed',
            startedAt: '2026-06-08T12:00:00.000Z',
        },
    });
});

function response(input: {
    id: string;
    metadata?: Record<string, unknown>;
    responseMessageId?: string;
    status: TavernChatResponse['status'];
    updatedAt: string;
}): TavernChatResponse {
    return {
        chat_id: 'chat-1',
        completed_at: input.status === 'completed' ? input.updatedAt : null,
        created_at: '2026-06-08T12:00:00.000Z',
        id: input.id,
        metadata: input.metadata ?? {},
        participant_id: 'agt_hermes',
        request_message_id: 'message-user',
        response_message_id: input.responseMessageId ?? null,
        status: input.status,
        summary: null,
        updated_at: input.updatedAt,
    } as TavernChatResponse;
}
