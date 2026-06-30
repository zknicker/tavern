import { expect, test } from 'bun:test';
import type { ChatActiveReply } from '../../hooks/chats/chat-timeline-state.ts';
import {
    type AgentStatusChatRow,
    resolveAgentStatusExpression,
} from './agent-status-expression.ts';

const activeReply: ChatActiveReply = {
    agentId: 'agent-1',
    isThinking: true,
    runId: 'run_123',
    sessionKey: 'session-1',
    startedAt: '2026-06-13T12:00:00.000Z',
    text: '',
};

test('presence is idle without an active turn', () => {
    expect(resolveAgentStatusExpression({ activeReply: null, rows: [] })).toBe('idle');
});

test('presence thinks before reply text starts', () => {
    expect(resolveAgentStatusExpression({ activeReply, rows: [] })).toBe('thinking');
});

test('presence replies when visible reply text streams', () => {
    expect(
        resolveAgentStatusExpression({
            activeReply: { ...activeReply, isThinking: false, text: 'Working on it.' },
            rows: [],
        })
    ).toBe('happy');
});

test('presence focuses during command work', () => {
    expect(
        resolveAgentStatusExpression({
            activeReply,
            rows: [
                progressToolRow({
                    completedAt: null,
                    name: 'command',
                    status: 'running',
                }),
            ],
        })
    ).toBe('angry');
});

test('presence asks for input on clarification work', () => {
    expect(
        resolveAgentStatusExpression({
            activeReply,
            rows: [
                progressToolRow({
                    clarification: { disposition: null },
                    completedAt: null,
                    name: 'clarify',
                    status: 'running',
                }),
            ],
        })
    ).toBe('confused');
});

test('presence sweats on failed progress', () => {
    expect(
        resolveAgentStatusExpression({
            activeReply,
            rows: [
                progressToolRow({
                    completedAt: '2026-06-13T12:00:04.000Z',
                    name: 'command',
                    status: 'error',
                }),
            ],
        })
    ).toBe('sweat');
});

function progressToolRow(input: {
    clarification?: { disposition: null };
    completedAt: string | null;
    name: string;
    status: string | null;
}) {
    return {
        clarification: input.clarification ?? null,
        completedAt: input.completedAt,
        id: `act_${activeReply.runId}_tool`,
        kind: 'tool',
        toolCall: {
            name: input.name,
            status: input.status,
        },
    } as unknown as AgentStatusChatRow;
}
