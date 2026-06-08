import { expect, test } from 'bun:test';
import {
    applyLogSnapshot,
    applyReplySnapshot,
    clearTimelineTurn,
    completeTimelineTurn,
    emptyTimelineState,
    failTimelineTurn,
    patchTimelineProgress,
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
    expect(state.activeTurn).toEqual(turn);
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
    expect(next.activeTurn).toBeNull();
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
    expect(next.activeTurn?.runId).toBe('run-1');
    expect(next.timeline[0]?.id).toBe('act_tool_web');
});

test('patchTimelineProgress adds live activity before durable log data arrives', () => {
    const state = patchTimelineProgress(startTimelineTurn(emptyTimelineState(), turn), {
        step: {
            id: 'tool:web',
            kind: 'tool',
            label: 'Using web search',
            status: 'active',
        },
        timestamp: '2026-04-21T16:08:43.000Z',
        turn,
    });

    expect(state.timeline).toMatchObject([
        {
            completedAt: null,
            id: 'act_run-1_tool_web',
            kind: 'tool',
            toolCall: {
                label: 'web search',
                name: 'tool',
            },
        },
    ]);
    expect(state.activeTurn).toEqual(turn);
});

test('applyLogSnapshot preserves live progress rows while the turn is active', () => {
    const live = patchTimelineProgress(startTimelineTurn(emptyTimelineState(), turn), {
        step: {
            id: 'tool:web',
            kind: 'tool',
            label: 'Using web search',
            status: 'active',
        },
        timestamp: '2026-04-21T16:08:43.000Z',
        turn,
    });

    const next = applyLogSnapshot(live, {
        limit: 100,
        offset: 0,
        rows: [],
        total: 0,
    });

    expect(next.timeline.map((row) => row.id)).toEqual(['act_run-1_tool_web']);
    expect(next.totalRows).toBe(1);
});

test('patchTimelineProgress updates the same preamble and Hermes tool rows through completion', () => {
    const withPreamble = patchTimelineProgress(startTimelineTurn(emptyTimelineState(), turn), {
        step: {
            detail: 'I will inspect the workspace before replying.',
            id: 'assistant-preamble',
            kind: 'message',
            label: 'Assistant reply',
            status: 'active',
        },
        timestamp: '2026-04-21T16:08:43.000Z',
        turn,
    });
    const withRunningTool = patchTimelineProgress(withPreamble, {
        step: {
            id: 'call_mock_read_123',
            kind: 'tool',
            label: 'read from QA_KICKOFF_TASK.md',
            status: 'active',
            toolCallId: 'call_mock_read_123',
            toolName: 'read',
        },
        timestamp: '2026-04-21T16:08:44.000Z',
        turn,
    });
    const completed = patchTimelineProgress(withRunningTool, {
        step: {
            detail: '# QA kickoff task',
            id: 'call_mock_read_123',
            kind: 'tool',
            label: 'read from QA_KICKOFF_TASK.md',
            status: 'completed',
            toolCallId: 'call_mock_read_123',
            toolName: 'read',
        },
        timestamp: '2026-04-21T16:08:48.000Z',
        turn,
    });

    expect(completed.timeline.map((row) => row.id)).toEqual([
        'act_run-1_assistant-preamble',
        'act_run-1_call_mock_read_123',
    ]);
    expect(completed.timeline[0]).toMatchObject({
        kind: 'message',
        message: {
            content: 'I will inspect the workspace before replying.',
            sourceSessionKey: 'session-1',
        },
    });
    expect(completed.timeline[1]).toMatchObject({
        completedAt: '2026-04-21T16:08:48.000Z',
        startedAt: '2026-04-21T16:08:44.000Z',
        toolCall: {
            callId: 'call_mock_read_123',
            name: 'read',
        },
    });
});

test('applyLogSnapshot preserves live progress rows while replacing a pending turn id', () => {
    const pendingTurn = {
        ...turn,
        runId: 'pending:msg-1',
        sessionKey: '',
    };
    const live = patchTimelineProgress(startTimelineTurn(emptyTimelineState(), pendingTurn), {
        step: {
            id: 'tool:web',
            kind: 'tool',
            label: 'Using web search',
            status: 'active',
        },
        timestamp: '2026-04-21T16:08:43.000Z',
        turn,
    });

    const next = applyLogSnapshot(live, {
        limit: 100,
        offset: 0,
        rows: [],
        total: 0,
    });

    expect(next.activeReply?.runId).toBe('pending:msg-1');
    expect(next.timeline.map((row) => row.id)).toEqual(['act_run-1_tool_web']);
    expect(next.totalRows).toBe(1);
});

test('applyLogSnapshot clears live progress rows when the assistant message lands', () => {
    const live = patchTimelineProgress(startTimelineTurn(emptyTimelineState(), turn), {
        step: {
            id: 'tool:web',
            kind: 'tool',
            label: 'Using web search',
            status: 'active',
        },
        timestamp: '2026-04-21T16:08:43.000Z',
        turn,
    });

    const next = applyLogSnapshot(live, {
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

    expect(next.timeline.map((row) => row.id)).toEqual(['message-1']);
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
    expect(clearTimelineTurn(state, { runId: 'run-1' }).activeTurn).toBeNull();
});

test('completeTimelineTurn keeps active reply visible while clearing active work', () => {
    const completed = completeTimelineTurn(startTimelineTurn(emptyTimelineState(), turn), {
        completedAt: '2026-04-21T16:08:46.000Z',
        turn,
    });

    expect(completed.activeReply?.runId).toBe('run-1');
    expect(completed.activeReply?.completedAt).toBe('2026-04-21T16:08:46.000Z');
    expect(completed.activeReply?.isThinking).toBe(false);
    expect(completed.activeTurn).toBeNull();
});

test('completeTimelineTurn marks live progress rows complete', () => {
    const running = patchTimelineProgress(startTimelineTurn(emptyTimelineState(), turn), {
        step: {
            id: 'call_read_1',
            kind: 'tool',
            label: 'read README.md',
            status: 'active',
            toolCallId: 'call_read_1',
            toolName: 'read',
        },
        timestamp: '2026-04-21T16:08:43.000Z',
        turn,
    });
    const completed = completeTimelineTurn(running, {
        completedAt: '2026-04-21T16:08:46.000Z',
        turn,
    });

    expect(completed.timeline[0]).toMatchObject({
        completedAt: '2026-04-21T16:08:46.000Z',
        id: 'act_run-1_call_read_1',
    });
});

test('failTimelineTurn stores a failed turn marker', () => {
    const failed = failTimelineTurn(startTimelineTurn(emptyTimelineState(), turn), {
        error: 'boom',
        turn,
    });

    expect(failed.activeReply).toBeNull();
    expect(failed.activeTurn).toBeNull();
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
