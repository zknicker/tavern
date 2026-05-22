import { expect, test } from 'bun:test';
import {
    applyLogSnapshot,
    applyReplySnapshot,
    clearTimelineTurn,
    completeTimelineTurn,
    emptyTimelineState,
    failTimelineTurn,
    startTimelineTurn,
    updateTimelineReply,
} from './chat-timeline-state.ts';

const turn = {
    agentId: 'claw',
    chatId: 'chat-1',
    runId: 'run-1',
    sessionKey: 'session-1',
    startedAt: '2026-04-21T16:08:42.000Z',
};

test('startTimelineTurn creates blank active reply state', () => {
    const state = startTimelineTurn(emptyTimelineState(), turn);

    expect(state.activeReply).toMatchObject({
        agentId: 'claw',
        isThinking: true,
        runId: 'run-1',
        sessionKey: 'session-1',
        startedAt: '2026-04-21T16:08:42.000Z',
        text: '',
    });
    expect(state.failedTurn).toBeNull();
});

test('applyLogSnapshot clears the active reply when the assistant message lands', () => {
    const state = startTimelineTurn(emptyTimelineState(), turn);
    const next = applyLogSnapshot(state, {
        limit: 100,
        offset: 0,
        rows: [
            {
                actor: { id: 'claw', kind: 'agent' },
                connectsToNext: false,
                connectsToPrevious: false,
                id: 'message-1',
                isFirstInGroup: true,
                kind: 'message',
                message: {
                    tavernAgentId: 'claw',
                    content: "that's the move",
                    id: 'message-1',
                    sender: 'Claw',
                    senderType: 'agent',
                    sourceSessionId: null,
                    sourceSessionKey: 'session-1',
                    timestamp: '2026-04-21T16:08:49.000Z',
                },
            },
        ],
        total: 1,
    });

    expect(next.activeReply).toBeNull();
    expect(next.timeline).toHaveLength(1);
});

test('applyLogSnapshot preserves active reply while durable activity is running', () => {
    const state = startTimelineTurn(emptyTimelineState(), turn);
    const next = applyLogSnapshot(state, {
        limit: 100,
        offset: 0,
        rows: [
            {
                actor: { id: 'claw', kind: 'agent' },
                completedAt: null,
                connectsToNext: false,
                connectsToPrevious: false,
                id: 'act_tool_web',
                isFirstInGroup: true,
                kind: 'tool',
                sessionKey: 'session-1',
                spawnedRelationships: [],
                startedAt: '2026-04-21T16:08:43.000Z',
                toolCall: {
                    callId: 'call-1',
                    facts: [],
                    label: 'web search',
                    name: 'web',
                    status: 'running',
                    summaryParts: ['web search'],
                },
            },
        ],
        total: 1,
    });

    expect(next.activeReply?.runId).toBe('run-1');
    expect(next.timeline[0]?.id).toBe('act_tool_web');
});

test('updateTimelineReply stores streamed text and thinking state', () => {
    const state = updateTimelineReply(startTimelineTurn(emptyTimelineState(), turn), {
        isThinking: false,
        text: 'Done',
        turn,
    });

    expect(state.activeReply).toMatchObject({
        isThinking: false,
        text: 'Done',
    });
});

test('updateTimelineReply accumulates delta-only streamed text', () => {
    const first = updateTimelineReply(startTimelineTurn(emptyTimelineState(), turn), {
        delta: 'Hel',
        text: '',
        turn,
    });
    const second = updateTimelineReply(first, {
        delta: 'lo',
        text: '',
        turn,
    });

    expect(second.activeReply?.text).toBe('Hello');
});

test('clearTimelineTurn only clears the matching run', () => {
    const state = startTimelineTurn(emptyTimelineState(), turn);

    expect(clearTimelineTurn(state, { runId: 'other' }).activeReply?.runId).toBe('run-1');
    expect(clearTimelineTurn(state, { runId: 'run-1' }).activeReply).toBeNull();
});

test('completeTimelineTurn keeps active reply visible until durable history catches up', () => {
    const completed = completeTimelineTurn(startTimelineTurn(emptyTimelineState(), turn), {
        completedAt: '2026-04-21T16:08:46.000Z',
        turn,
    });

    expect(completed.activeReply?.runId).toBe('run-1');
});

test('failTimelineTurn stores a failed turn marker', () => {
    const failed = failTimelineTurn(startTimelineTurn(emptyTimelineState(), turn), {
        error: 'boom',
        turn,
    });

    expect(failed.activeReply).toBeNull();
    expect(failed.failedTurn).toEqual({ error: 'boom', turn });
});

test('applyReplySnapshot does not restore thinking after the assistant message is visible', () => {
    const logged = applyLogSnapshot(emptyTimelineState(), {
        limit: 100,
        offset: 0,
        rows: [
            {
                actor: { id: 'claw', kind: 'agent' },
                connectsToNext: false,
                connectsToPrevious: false,
                id: 'message-1',
                isFirstInGroup: true,
                kind: 'message',
                message: {
                    tavernAgentId: 'claw',
                    content: 'Done.',
                    id: 'message-1',
                    sender: 'Claw',
                    senderType: 'agent',
                    sourceSessionId: null,
                    sourceSessionKey: 'session-1',
                    timestamp: '2026-04-21T16:08:49.000Z',
                },
            },
        ],
        total: 1,
    });

    const next = applyReplySnapshot(logged, {
        agentId: 'claw',
        isThinking: true,
        runId: 'run-1',
        sessionKey: 'session-1',
        startedAt: '2026-04-21T16:08:42.000Z',
        text: '',
    });

    expect(next.activeReply).toBeNull();
});
