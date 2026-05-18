import assert from 'node:assert/strict';
import test from 'node:test';
import type { AgentRuntimeSessionMessage } from '@tavern/api';
import { buildSessionToolCallsFromMessages } from './session-tool-call-projection.ts';

test('buildSessionToolCallsFromMessages derives tool calls from chat history messages', () => {
    const toolCalls = buildSessionToolCallsFromMessages([
        message({
            content: '',
            id: 'message-1',
            metadata: {
                parts: [
                    {
                        arguments: { path: '/tmp/file.txt' },
                        id: 'call-1',
                        name: 'read',
                        type: 'toolCall',
                    },
                ],
            },
            sender: 'assistant',
            senderType: 'agent',
            timestamp: '2026-05-12T12:00:01.000Z',
        }),
        message({
            content: '{"childSessionKey":"agent:tiny:tavern:channel:child","ok":true}',
            id: 'message-2',
            metadata: {
                toolCallId: 'call-1',
                toolName: 'read',
            },
            sender: 'toolResult',
            senderType: 'system',
            timestamp: '2026-05-12T12:00:02.000Z',
        }),
    ]);

    assert.equal(toolCalls.length, 1);
    assert.deepEqual(toolCalls[0], {
        arguments: { path: '/tmp/file.txt' },
        childSessionKey: 'agent:tiny:tavern:channel:child',
        finishedAt: '2026-05-12T12:00:02.000Z',
        id: 'message-1:tool:call-1',
        isError: null,
        messageId: 'message-1',
        result: {
            childSessionKey: 'agent:tiny:tavern:channel:child',
            ok: true,
        },
        sessionKey: 'agent:blippy:tavern:channel:chat-1',
        startedAt: '2026-05-12T12:00:01.000Z',
        toolCallId: 'call-1',
        toolName: 'read',
    });
});

function message(
    input: Pick<
        AgentRuntimeSessionMessage,
        'content' | 'id' | 'metadata' | 'sender' | 'senderType' | 'timestamp'
    >
): AgentRuntimeSessionMessage {
    return {
        agentId: input.senderType === 'agent' ? 'blippy' : null,
        chatId: 'chat-1',
        senderName: input.sender,
        sessionKey: 'agent:blippy:tavern:channel:chat-1',
        ...input,
    };
}
