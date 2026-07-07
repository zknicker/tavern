import { expect, test } from 'bun:test';
import {
    applyLogSnapshot,
    applyReplySnapshot,
    clearTimelineTurn,
    completeTimelineTurn,
    emptyTimelineState,
    failTimelineTurn,
    optimisticallyStopTimelineTurn,
    patchTimelineProgress,
    patchTimelineWithSteerNotice,
    readTimelineSteerNotice,
    removeOptimisticStoppedTurn,
    rollbackTimelineSteerNotice,
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

function stoppedRow() {
    return {
        id: 'response-1:cancelled',
        kind: 'system' as const,
        responseId: 'response-1',
        systemKind: 'turnStatus' as const,
        timestamp: '2026-04-21T16:08:45.000Z',
        turnStatus: {
            agentId: 'claw',
            runId: 'run-1',
            sessionKey: 'session-1',
            status: 'stopped' as const,
            text: 'Agent response stopped.',
        },
    };
}

test('startTimelineTurn creates blank active reply state', () => {
    const state = startTimelineTurn(emptyTimelineState(), turn);

    expect(state.activeReplies[0]).toMatchObject({
        agentId: 'claw',
        isThinking: true,
        runId: 'run-1',
        sessionKey: 'session-1',
        startedAt: '2026-04-21T16:08:42.000Z',
        text: '',
    });
    expect(state.activeTurns).toEqual([turn]);
    expect(state.failedTurns).toEqual([]);
});

test('applyLogSnapshot clears the active reply when the assistant message lands', () => {
    const state = startTimelineTurn(emptyTimelineState(), turn);
    const next = applyLogSnapshot(state, {
        limit: 100,
        nextBeforeSequence: null,
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
        totalMessages: 1,
    });

    expect(next.activeReplies).toEqual([]);
    expect(next.activeTurns).toEqual([]);
    expect(next.timeline).toHaveLength(1);
});

test('clearTimelineTurn clears a matching active turn after active reply is gone', () => {
    const state = {
        ...emptyTimelineState(),
        activeTurns: [turn],
    };

    const next = clearTimelineTurn(state, { runId: 'run-1' });

    expect(next.activeReplies).toEqual([]);
    expect(next.activeTurns).toEqual([]);
});

test('applyLogSnapshot preserves active reply while durable activity is running', () => {
    const state = startTimelineTurn(emptyTimelineState(), turn);
    const next = applyLogSnapshot(state, {
        limit: 100,
        nextBeforeSequence: null,
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
        totalMessages: 1,
    });

    expect(next.activeReplies[0]?.runId).toBe('run-1');
    expect(next.activeTurns[0]?.runId).toBe('run-1');
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
    expect(state.activeTurns).toEqual([turn]);
});

test('patchTimelineWithSteerNotice inserts a visible user row before durable log data arrives', () => {
    const state = patchTimelineWithSteerNotice(startTimelineTurn(emptyTimelineState(), turn), {
        content: 'use the shorter summary',
        runId: 'run-1',
        timestamp: '2026-04-21T16:08:44.000Z',
    });

    expect(state.activeTurns).toEqual([turn]);
    expect(state.timeline).toHaveLength(1);
    expect(state.timeline[0]).toMatchObject({
        id: 'act_run-1_runtime_notice_steered_message',
        kind: 'message',
        message: {
            content: 'use the shorter summary',
            sender: 'You',
            senderType: 'user',
        },
    });
    expect(readTimelineSteerNotice(state, { runId: 'run-1' })).toMatchObject({
        message: {
            content: 'use the shorter summary',
        },
    });
});

test('applyLogSnapshot preserves optimistic steer rows during stale live refetches', () => {
    const live = patchTimelineWithSteerNotice(startTimelineTurn(emptyTimelineState(), turn), {
        content: 'use the shorter summary',
        runId: 'run-1',
        timestamp: '2026-04-21T16:08:44.000Z',
    });
    const next = applyLogSnapshot(live, {
        limit: 100,
        nextBeforeSequence: null,
        rows: [],
        totalMessages: 0,
    });

    expect(next.timeline.map((row) => row.id)).toEqual([
        'act_run-1_runtime_notice_steered_message',
    ]);
    expect(next.activeTurns).toEqual([turn]);
    expect(readTimelineSteerNotice(next, { runId: 'run-1' })).toMatchObject({
        message: {
            content: 'use the shorter summary',
        },
    });
});

test('rollbackTimelineSteerNotice restores the previous visible steer row', () => {
    const accepted = patchTimelineWithSteerNotice(startTimelineTurn(emptyTimelineState(), turn), {
        content: 'first steer',
        runId: 'run-1',
        timestamp: '2026-04-21T16:08:44.000Z',
    });
    const previousNotice = readTimelineSteerNotice(accepted, { runId: 'run-1' });
    const failed = patchTimelineWithSteerNotice(accepted, {
        content: 'failed steer',
        runId: 'run-1',
        timestamp: '2026-04-21T16:08:46.000Z',
    });
    const rolledBack = rollbackTimelineSteerNotice(failed, {
        content: 'failed steer',
        previousNotice,
        runId: 'run-1',
    });

    expect(rolledBack.timeline).toHaveLength(1);
    expect(rolledBack.timeline[0]).toMatchObject({
        message: {
            content: 'first steer',
        },
    });
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
        nextBeforeSequence: null,
        rows: [],
        totalMessages: 0,
    });

    expect(next.timeline.map((row) => row.id)).toEqual(['act_run-1_tool_web']);
    expect(next.totalMessages).toBe(0);
});

test('optimisticallyStopTimelineTurn adds a local stopped row without dropping active state', () => {
    const active = startTimelineTurn(emptyTimelineState(), turn);
    const stopped = optimisticallyStopTimelineTurn(active, {
        chatId: 'chat-1',
        runId: 'run-1',
        stoppedAt: '2026-04-21T16:08:44.000Z',
    });

    expect(stopped.activeReplies[0]?.runId).toBe('run-1');
    expect(stopped.activeTurns[0]?.runId).toBe('run-1');
    expect(stopped.timeline).toMatchObject([
        {
            id: 'optimistic-stop:run-1',
            kind: 'system',
            systemKind: 'turnStatus',
            turnStatus: {
                agentId: 'claw',
                runId: 'run-1',
                sessionKey: 'session-1',
                text: 'Agent response stopped.',
            },
        },
    ]);
});

test('applyLogSnapshot preserves optimistic stopped rows until durable cancellation lands', () => {
    const stopped = optimisticallyStopTimelineTurn(startTimelineTurn(emptyTimelineState(), turn), {
        chatId: 'chat-1',
        runId: 'run-1',
        stoppedAt: '2026-04-21T16:08:44.000Z',
    });
    const next = applyLogSnapshot(stopped, {
        limit: 100,
        nextBeforeSequence: null,
        rows: [],
        totalMessages: 0,
    });

    expect(next.timeline.map((row) => row.id)).toEqual(['optimistic-stop:run-1']);
});

test('applyLogSnapshot replaces optimistic stopped rows with durable cancellation', () => {
    const stopped = optimisticallyStopTimelineTurn(startTimelineTurn(emptyTimelineState(), turn), {
        chatId: 'chat-1',
        runId: 'run-1',
        stoppedAt: '2026-04-21T16:08:44.000Z',
    });
    const next = applyLogSnapshot(stopped, {
        limit: 100,
        nextBeforeSequence: null,
        rows: [stoppedRow()],
        totalMessages: 1,
    });

    expect(next.activeReplies).toEqual([]);
    expect(next.activeTurns).toEqual([]);
    expect(next.timeline.map((row) => row.id)).toEqual(['response-1:cancelled']);
});

test('removeOptimisticStoppedTurn removes only the local stopped row', () => {
    const stopped = optimisticallyStopTimelineTurn(startTimelineTurn(emptyTimelineState(), turn), {
        chatId: 'chat-1',
        runId: 'run-1',
        stoppedAt: '2026-04-21T16:08:44.000Z',
    });
    const next = removeOptimisticStoppedTurn(stopped, { runId: 'run-1' });

    expect(next.timeline).toHaveLength(0);
    expect(next.activeReplies[0]?.runId).toBe('run-1');
});

test('patchTimelineProgress updates the same preamble and tool rows through completion', () => {
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

test('applyLogSnapshot preserves live progress rows when the optimistic run id matches Runtime', () => {
    const optimisticTurn = {
        ...turn,
        runId: 'run_1',
        sessionKey: '',
    };
    const live = patchTimelineProgress(startTimelineTurn(emptyTimelineState(), optimisticTurn), {
        step: {
            id: 'tool:web',
            kind: 'tool',
            label: 'Using web search',
            status: 'active',
        },
        timestamp: '2026-04-21T16:08:43.000Z',
        turn: optimisticTurn,
    });

    const next = applyLogSnapshot(live, {
        limit: 100,
        nextBeforeSequence: null,
        rows: [],
        totalMessages: 0,
    });

    expect(next.activeReplies[0]?.runId).toBe('run_1');
    expect(next.timeline.map((row) => row.id)).toEqual(['act_run_1_tool_web']);
    expect(next.totalMessages).toBe(0);
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
        nextBeforeSequence: null,
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
        totalMessages: 1,
    });

    expect(next.timeline.map((row) => row.id)).toEqual(['message-1']);
});

test('updateTimelineReply stores streamed text and thinking state', () => {
    const state = updateTimelineReply(startTimelineTurn(emptyTimelineState(), turn), {
        isThinking: false,
        text: 'Done',
        turn,
    });

    expect(state.activeReplies[0]).toMatchObject({
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

    expect(second.activeReplies[0]?.text).toBe('Hello');
});

test('updateTimelineReply ignores stale shorter full-text snapshots for the same run', () => {
    const streamed = updateTimelineReply(startTimelineTurn(emptyTimelineState(), turn), {
        isThinking: false,
        text: "Absolutely - here's another one:\n\nAt morning's edge",
        turn,
    });
    const stale = updateTimelineReply(streamed, {
        isThinking: false,
        text: "Absolutely - here's anothe",
        turn,
    });

    expect(stale.activeReplies[0]?.text).toBe(
        "Absolutely - here's another one:\n\nAt morning's edge"
    );
    expect(stale.activeReplies[0]?.isThinking).toBe(false);
});

test('clearTimelineTurn only clears the matching run', () => {
    const state = startTimelineTurn(emptyTimelineState(), turn);

    expect(clearTimelineTurn(state, { runId: 'other' }).activeReplies[0]?.runId).toBe('run-1');
    expect(clearTimelineTurn(state, { runId: 'run-1' }).activeReplies).toEqual([]);
    expect(clearTimelineTurn(state, { runId: 'run-1' }).activeTurns).toEqual([]);
});

test('completeTimelineTurn keeps active reply visible while clearing active work', () => {
    const completed = completeTimelineTurn(startTimelineTurn(emptyTimelineState(), turn), {
        completedAt: '2026-04-21T16:08:46.000Z',
        turn,
    });

    expect(completed.activeReplies[0]?.runId).toBe('run-1');
    expect(completed.activeReplies[0]?.completedAt).toBe('2026-04-21T16:08:46.000Z');
    expect(completed.activeReplies[0]?.isThinking).toBe(false);
    expect(completed.activeTurns).toEqual([]);
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

    expect(failed.activeReplies).toEqual([]);
    expect(failed.activeTurns).toEqual([]);
    expect(failed.failedTurns).toEqual([{ error: 'boom', responseId: null, turn }]);
});

test('updateTimelineReply replace resets streamed text without ending the turn', () => {
    const streamed = updateTimelineReply(startTimelineTurn(emptyTimelineState(), turn), {
        isThinking: false,
        text: 'First narration segment',
        turn,
    });
    const cleared = updateTimelineReply(streamed, {
        isThinking: true,
        replace: true,
        text: '',
        turn,
    });

    expect(cleared.activeReplies[0]).toMatchObject({
        isThinking: true,
        runId: 'run-1',
        text: '',
    });
});

test('applyLogSnapshot keeps the active reply when narration activity messages land', () => {
    const streamed = updateTimelineReply(startTimelineTurn(emptyTimelineState(), turn), {
        isThinking: false,
        text: 'Looking into it',
        turn,
    });
    const next = applyLogSnapshot(streamed, {
        limit: 100,
        nextBeforeSequence: null,
        rows: [
            {
                actor: { id: 'claw', kind: 'agent' },
                connectsToNext: false,
                connectsToPrevious: false,
                id: 'act_run-1_message_1',
                isFirstInGroup: true,
                kind: 'message',
                message: {
                    tavernAgentId: 'claw',
                    content: 'First narration segment',
                    id: 'act_run-1_message_1',
                    metadata: { runtime: { runId: 'run-1', sessionKey: 'session-1' } },
                    sender: 'claw',
                    senderType: 'agent',
                    sourceSessionId: null,
                    sourceSessionKey: 'session-1',
                    timestamp: '2026-04-21T16:08:44.000Z',
                },
            },
        ],
        totalMessages: 1,
    });

    expect(next.activeReplies[0]?.runId).toBe('run-1');
    expect(next.activeReplies[0]?.text).toBe('Looking into it');
});

test('applyReplySnapshot does not regress streamed text from a stale snapshot', () => {
    const streamed = updateTimelineReply(startTimelineTurn(emptyTimelineState(), turn), {
        isThinking: false,
        text: 'Long streamed answer',
        turn,
    });
    const next = applyReplySnapshot(streamed, {
        agentId: 'claw',
        isThinking: true,
        runId: 'run-1',
        sessionKey: 'session-1',
        startedAt: turn.startedAt,
        text: 'Long',
    });

    expect(next.activeReplies[0]?.text).toBe('Long streamed answer');
    expect(next.activeReplies[0]?.isThinking).toBe(false);
});

test('applyReplySnapshot does not restore thinking after the assistant message is visible', () => {
    const logged = applyLogSnapshot(emptyTimelineState(), {
        limit: 100,
        nextBeforeSequence: null,
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
        totalMessages: 1,
    });

    const next = applyReplySnapshot(logged, {
        agentId: 'claw',
        isThinking: true,
        runId: 'run-1',
        sessionKey: 'session-1',
        startedAt: '2026-04-21T16:08:42.000Z',
        text: '',
    });

    expect(next.activeReplies).toEqual([]);
});

const otherTurn = {
    agentId: 'tiny',
    chatId: 'chat-1',
    runId: 'run-2',
    sessionKey: 'session-2',
    startedAt: '2026-04-21T16:08:43.000Z',
};

test('two concurrent turns keep independent live replies', () => {
    const both = startTimelineTurn(startTimelineTurn(emptyTimelineState(), turn), otherTurn);
    const streamed = updateTimelineReply(
        updateTimelineReply(both, { delta: 'From claw', text: '', turn }),
        { delta: 'From tiny', text: '', turn: otherTurn }
    );

    expect(streamed.activeReplies.map((reply) => reply.runId)).toEqual(['run-1', 'run-2']);
    expect(streamed.activeReplies[0]?.text).toBe('From claw');
    expect(streamed.activeReplies[1]?.text).toBe('From tiny');
    expect(streamed.activeTurns.map((entry) => entry.runId)).toEqual(['run-1', 'run-2']);
});

test('completing one turn leaves the other run streaming', () => {
    const both = startTimelineTurn(startTimelineTurn(emptyTimelineState(), turn), otherTurn);
    const completed = completeTimelineTurn(both, {
        completedAt: '2026-04-21T16:08:46.000Z',
        turn,
    });

    expect(completed.activeReplies.find((reply) => reply.runId === 'run-1')?.isThinking).toBe(
        false
    );
    expect(completed.activeReplies.find((reply) => reply.runId === 'run-2')?.isThinking).toBe(true);
    expect(completed.activeTurns.map((entry) => entry.runId)).toEqual(['run-2']);
});

test('failing one turn keeps the other run and only clears its own banner on restart', () => {
    const both = startTimelineTurn(startTimelineTurn(emptyTimelineState(), turn), otherTurn);
    const failed = failTimelineTurn(both, { error: 'boom', turn });

    expect(failed.activeReplies.map((reply) => reply.runId)).toEqual(['run-2']);
    expect(failed.failedTurns.map((failure) => failure.turn.runId)).toEqual(['run-1']);

    // The same agent starting a new turn clears its failure; the other
    // agent's failure would stay.
    const restarted = startTimelineTurn(failed, {
        ...turn,
        runId: 'run-3',
        startedAt: '2026-04-21T16:09:00.000Z',
    });

    expect(restarted.failedTurns).toEqual([]);
    expect(restarted.activeReplies.map((reply) => reply.runId)).toEqual(['run-2', 'run-3']);
});

test('stop for one run leaves the other untouched', () => {
    const both = startTimelineTurn(startTimelineTurn(emptyTimelineState(), turn), otherTurn);
    const stopped = optimisticallyStopTimelineTurn(both, {
        chatId: 'chat-1',
        runId: 'run-2',
        stoppedAt: '2026-04-21T16:08:44.000Z',
    });

    expect(stopped.timeline.map((row) => row.id)).toEqual(['optimistic-stop:run-2']);
    expect(stopped.activeReplies.map((reply) => reply.runId)).toEqual(['run-1', 'run-2']);
});
