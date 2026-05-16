import { expect, test } from 'bun:test';
import {
    applyLogSnapshot,
    applyReplySnapshot,
    clearTimelineTurn,
    completeTimelineTurn,
    emptyTimelineState,
    startTimelineTurn,
    updateTimelineReply,
    updateTimelineTurnProgress,
} from './chat-timeline-state.ts';

test('applyLogSnapshot clears the active reply when the assistant message lands', () => {
    const state = updateTimelineTurnProgress(
        startTimelineTurn(emptyTimelineState(), {
            agentId: 'claw',
            chatId: 'chat-1',
            runId: 'run-1',
            sessionKey: 'session-1',
            startedAt: '2026-04-21T16:08:42.000Z',
        }),
        {
            step: {
                id: 'tool:web',
                kind: 'tool',
                label: 'Using web search',
                status: 'active',
            },
            turn: {
                agentId: 'claw',
                chatId: 'chat-1',
                runId: 'run-1',
                sessionKey: 'session-1',
                startedAt: '2026-04-21T16:08:42.000Z',
            },
        }
    );

    const next = applyLogSnapshot(state, {
        limit: 100,
        offset: 0,
        rows: [
            {
                actor: null,
                connectsToNext: false,
                connectsToPrevious: false,
                id: 'message-1',
                isFirstInGroup: true,
                kind: 'message',
                message: {
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
    expect(next.activeReplySteps).toEqual([]);
    expect(next.completedProgress?.reply.runId).toBe('run-1');
    expect(next.timeline).toHaveLength(1);
});

test('applyLogSnapshot keeps completed progress until durable activity lands', () => {
    const turn = {
        agentId: 'claw',
        chatId: 'chat-1',
        runId: 'run-1',
        sessionKey: 'session-1',
        startedAt: '2026-04-21T16:08:42.000Z',
    };
    const state = updateTimelineTurnProgress(startTimelineTurn(emptyTimelineState(), turn), {
        step: {
            id: 'tool:web',
            kind: 'tool',
            label: 'Using web search',
            status: 'active',
        },
        turn,
    });

    const withMessage = applyLogSnapshot(state, {
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
                    timestamp: '2026-04-21T16:08:45.000Z',
                },
            },
        ],
        total: 1,
    });

    expect(withMessage.completedProgress).toEqual({
        completedAt: '2026-04-21T16:08:45.000Z',
        reply: {
            agentId: 'claw',
            isThinking: true,
            runId: 'run-1',
            sessionKey: 'session-1',
            startedAt: '2026-04-21T16:08:42.000Z',
            text: '',
        },
        startedAt: '2026-04-21T16:08:42.000Z',
        steps: [
            {
                id: 'tool:web',
                kind: 'tool',
                label: 'Using web search',
                status: 'completed',
            },
        ],
    });

    const withDurableTool = applyLogSnapshot(withMessage, {
        limit: 100,
        offset: 0,
        rows: [
            {
                actor: { id: 'claw', kind: 'agent' },
                completedAt: '2026-04-21T16:08:44.000Z',
                connectsToNext: true,
                connectsToPrevious: false,
                id: 'tool-1',
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
                    status: 'ok',
                    summaryParts: ['web search'],
                },
            },
            ...withMessage.timeline,
        ],
        total: 2,
    });

    expect(withDurableTool.completedProgress).toBeNull();

    const withDurableSystemActivity = applyLogSnapshot(withMessage, {
        limit: 100,
        offset: 0,
        rows: [
            {
                id: 'thinking-1',
                kind: 'system',
                systemKind: 'thinking',
                thinking: {
                    id: 'thinking-1',
                    messageId: 'message-1',
                    sender: 'Claw',
                    text: 'Need to inspect command output before replying.',
                    timestamp: '2026-04-21T16:08:44.500Z',
                },
                timestamp: '2026-04-21T16:08:44.500Z',
            },
            ...withMessage.timeline,
        ],
        total: 2,
    });

    expect(withDurableSystemActivity.completedProgress).toBeNull();
});

test('updateTimelineTurnProgress adopts a hydrated active reply for the same session', () => {
    const state = applyReplySnapshot(emptyTimelineState(), {
        agentId: 'claw',
        isThinking: true,
        runId: 'openclaw-active:session-1:2026-04-21T16:08:40.000Z',
        sessionKey: 'session-1',
        startedAt: '2026-04-21T16:08:40.000Z',
        text: '',
    });

    const next = updateTimelineTurnProgress(state, {
        receivedAt: '2026-04-21T16:08:43.000Z',
        step: {
            id: 'tool:web',
            kind: 'tool',
            label: 'Using web search',
            status: 'active',
        },
        turn: {
            agentId: 'claw',
            chatId: 'chat-1',
            runId: 'run-1',
            sessionKey: 'session-1',
            startedAt: '2026-04-21T16:08:42.000Z',
        },
    });

    expect(next.activeReply?.runId).toBe('run-1');
    expect(next.activeReply?.startedAt).toBe('2026-04-21T16:08:42.000Z');
    expect(next.activeReplyProgressStartedAt).toBe('2026-04-21T16:08:43.000Z');
    expect(next.activeReplySteps).toEqual([
        {
            id: 'tool:web',
            kind: 'tool',
            label: 'Using web search',
            status: 'active',
        },
    ]);
});

test('applyLogSnapshot keeps completed progress when only durable worker activity exists', () => {
    const turn = {
        agentId: 'claw',
        chatId: 'chat-1',
        runId: 'run-1',
        sessionKey: 'session-1',
        startedAt: '2026-04-21T16:08:42.000Z',
    };
    const state = updateTimelineTurnProgress(startTimelineTurn(emptyTimelineState(), turn), {
        step: {
            id: 'tool:web',
            kind: 'tool',
            label: 'Using web search',
            status: 'completed',
        },
        turn,
    });

    const withMessage = applyLogSnapshot(state, {
        limit: 100,
        offset: 0,
        rows: [
            {
                actor: { id: 'claw', kind: 'agent' },
                completedAt: '2026-04-21T16:08:44.000Z',
                connectsToNext: true,
                connectsToPrevious: false,
                id: 'worker-1',
                isFirstInGroup: true,
                kind: 'worker',
                sessionKey: 'session-1',
                startedAt: '2026-04-21T16:08:43.000Z',
                worker: {
                    agentId: 'claw',
                    agentName: 'Claw',
                    chatTitle: 'Chat',
                    childSessionKey: null,
                    cleanupAfter: null,
                    createdAt: '2026-04-21T16:08:43.000Z',
                    deliveryStatus: null,
                    description: null,
                    detail: null,
                    endedAt: '2026-04-21T16:08:44.000Z',
                    error: null,
                    executionMode: 'main_session',
                    id: 'worker-1',
                    kind: 'cli',
                    lastEventAt: '2026-04-21T16:08:44.000Z',
                    notifyPolicy: null,
                    parentWorkerId: null,
                    progressSummary: null,
                    requesterSessionKey: null,
                    runId: 'run-1',
                    sessionKey: 'session-1',
                    source: 'agentRuntime',
                    sourceFlowId: null,
                    sourceId: 'worker-1',
                    startedAt: '2026-04-21T16:08:43.000Z',
                    status: 'succeeded',
                    syncedAt: '2026-04-21T16:08:44.000Z',
                    terminalSummary: null,
                    title: 'Agent turn',
                },
            },
            {
                actor: { id: 'claw', kind: 'agent' },
                connectsToNext: false,
                connectsToPrevious: true,
                id: 'message-1',
                isFirstInGroup: false,
                kind: 'message',
                message: {
                    tavernAgentId: 'claw',
                    content: 'Done.',
                    id: 'message-1',
                    sender: 'Claw',
                    senderType: 'agent',
                    sourceSessionId: null,
                    sourceSessionKey: 'session-1',
                    timestamp: '2026-04-21T16:08:45.000Z',
                },
            },
        ],
        total: 2,
    });

    expect(withMessage.completedProgress?.steps).toEqual([
        {
            id: 'tool:web',
            kind: 'tool',
            label: 'Using web search',
            status: 'completed',
        },
    ]);
});

test('applyLogSnapshot clears a matching live reply when durable history lands first', () => {
    const turn = {
        agentId: 'claw',
        chatId: 'chat-1',
        runId: 'run-1',
        sessionKey: 'session-1',
        startedAt: '2026-04-21T16:08:49.000Z',
    };
    const state = updateTimelineReply(startTimelineTurn(emptyTimelineState(), turn), {
        isThinking: false,
        replace: true,
        text: "that's the move",
        turn,
    });

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
                    actor: { id: 'claw', kind: 'agent' },
                    content: "that's the move",
                    id: 'message-1',
                    sender: 'Claw',
                    senderType: 'agent',
                    sourceSessionId: null,
                    sourceSessionKey: 'session-1',
                    timestamp: '2026-04-21T16:08:48.000Z',
                },
            },
        ],
        total: 1,
    });

    expect(next.activeReply).toBeNull();
    expect(next.timeline).toHaveLength(1);
});

test('applyLogSnapshot keeps repeated live reply text when durable history is old', () => {
    const turn = {
        agentId: 'claw',
        chatId: 'chat-1',
        runId: 'run-2',
        sessionKey: 'session-1',
        startedAt: '2026-04-21T16:08:49.000Z',
    };
    const state = updateTimelineReply(startTimelineTurn(emptyTimelineState(), turn), {
        isThinking: false,
        replace: true,
        text: 'OK',
        turn,
    });

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
                    actor: { id: 'claw', kind: 'agent' },
                    content: 'OK',
                    id: 'message-1',
                    sender: 'Claw',
                    senderType: 'agent',
                    sourceSessionId: null,
                    sourceSessionKey: 'session-1',
                    timestamp: '2026-04-21T16:07:00.000Z',
                },
            },
        ],
        total: 1,
    });

    expect(next.activeReply).toEqual({
        agentId: 'claw',
        isThinking: false,
        runId: 'run-2',
        sessionKey: 'session-1',
        startedAt: '2026-04-21T16:08:49.000Z',
        text: 'OK',
    });
});

test('applyReplySnapshot does not restore thinking after the assistant message is visible', () => {
    const state = applyLogSnapshot(emptyTimelineState(), {
        limit: 100,
        offset: 0,
        rows: [
            {
                actor: null,
                connectsToNext: false,
                connectsToPrevious: false,
                id: 'message-1',
                isFirstInGroup: true,
                kind: 'message',
                message: {
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

    const next = applyReplySnapshot(state, {
        agentId: 'claw',
        isThinking: true,
        runId: 'run-1',
        sessionKey: 'session-1',
        startedAt: '2026-04-21T16:08:42.000Z',
        text: '',
    });

    expect(next.activeReply).toBeNull();
});

test('applyReplySnapshot keeps thinking during the handoff after status clears', () => {
    const state = startTimelineTurn(emptyTimelineState(), {
        agentId: 'claw',
        chatId: 'chat-1',
        runId: 'run-1',
        sessionKey: 'session-1',
        startedAt: '2026-04-21T16:08:42.000Z',
    });

    const next = applyReplySnapshot(state, null);

    expect(next.activeReply).toEqual({
        agentId: 'claw',
        isThinking: true,
        runId: 'run-1',
        sessionKey: 'session-1',
        startedAt: '2026-04-21T16:08:42.000Z',
        text: '',
    });
});

test('updateTimelineReply stores streamed text and thinking state', () => {
    const state = startTimelineTurn(emptyTimelineState(), {
        agentId: 'claw',
        chatId: 'chat-1',
        runId: 'run-1',
        sessionKey: 'session-1',
        startedAt: '2026-04-21T16:08:42.000Z',
    });

    const next = updateTimelineReply(state, {
        delta: 'move',
        isThinking: false,
        text: "that's the move",
        turn: {
            agentId: 'claw',
            chatId: 'chat-1',
            runId: 'run-1',
            sessionKey: 'session-1',
            startedAt: '2026-04-21T16:08:42.000Z',
        },
    });

    expect(next.activeReply).toEqual({
        agentId: 'claw',
        isThinking: false,
        runId: 'run-1',
        sessionKey: 'session-1',
        startedAt: '2026-04-21T16:08:42.000Z',
        text: "that's the move",
    });
});

test('updateTimelineReply preserves completed progress when the final replacement lands first', () => {
    const turn = {
        agentId: 'claw',
        chatId: 'chat-1',
        runId: 'run-1',
        sessionKey: 'session-1',
        startedAt: '2026-04-21T16:08:42.000Z',
    };
    const state = updateTimelineTurnProgress(startTimelineTurn(emptyTimelineState(), turn), {
        step: {
            id: 'tool:web',
            kind: 'tool',
            label: 'Using web search',
            status: 'completed',
        },
        turn,
    });

    const next = updateTimelineReply(state, {
        isThinking: false,
        replace: true,
        text: 'Done.',
        turn,
    });

    expect(next.completedProgress?.steps).toEqual([
        {
            id: 'tool:web',
            kind: 'tool',
            label: 'Using web search',
            status: 'completed',
        },
    ]);
});

test('applyReplySnapshot does not let a stale status snapshot overwrite a richer live reply update', () => {
    const turn = {
        agentId: 'claw',
        chatId: 'chat-1',
        runId: 'run-1',
        sessionKey: 'session-1',
        startedAt: '2026-04-21T16:08:42.000Z',
    };
    const liveUpdated = updateTimelineReply(startTimelineTurn(emptyTimelineState(), turn), {
        isThinking: false,
        replace: true,
        text: "that's the move",
        turn,
    });

    const next = applyReplySnapshot(liveUpdated, {
        agentId: 'claw',
        isThinking: true,
        runId: 'run-1',
        sessionKey: 'session-1',
        startedAt: '2026-04-21T16:08:42.000Z',
        text: '',
    });

    expect(next.activeReply).toEqual({
        agentId: 'claw',
        isThinking: false,
        runId: 'run-1',
        sessionKey: 'session-1',
        startedAt: '2026-04-21T16:08:42.000Z',
        text: "that's the move",
    });
});

test('clearTimelineTurn only clears the matching run', () => {
    const state = updateTimelineTurnProgress(
        startTimelineTurn(emptyTimelineState(), {
            agentId: 'claw',
            chatId: 'chat-1',
            runId: 'run-2',
            sessionKey: 'session-1',
            startedAt: '2026-04-21T16:08:42.000Z',
        }),
        {
            step: {
                id: 'tool:web',
                kind: 'tool',
                label: 'Using web search',
                status: 'active',
            },
            turn: {
                agentId: 'claw',
                chatId: 'chat-1',
                runId: 'run-2',
                sessionKey: 'session-1',
                startedAt: '2026-04-21T16:08:42.000Z',
            },
        }
    );

    expect(clearTimelineTurn(state, { runId: 'run-1' }).activeReply).not.toBeNull();
    const cleared = clearTimelineTurn(state, { runId: 'run-2' });

    expect(cleared.activeReply).toBeNull();
    expect(cleared.activeReplySteps).toEqual([]);
});

test('completeTimelineTurn preserves active progress immediately on completion', () => {
    const turn = {
        agentId: 'claw',
        chatId: 'chat-1',
        runId: 'run-1',
        sessionKey: 'session-1',
        startedAt: '2026-04-21T16:08:42.000Z',
    };
    const state = updateTimelineTurnProgress(startTimelineTurn(emptyTimelineState(), turn), {
        receivedAt: '2026-04-21T16:08:43.000Z',
        step: {
            id: 'tool:web',
            kind: 'tool',
            label: 'Using web search',
            status: 'active',
        },
        turn,
    });

    const completed = completeTimelineTurn(state, {
        completedAt: '2026-04-21T16:08:46.000Z',
        turn,
    });

    expect(completed.completedProgress).toEqual({
        completedAt: '2026-04-21T16:08:46.000Z',
        reply: {
            agentId: 'claw',
            isThinking: true,
            runId: 'run-1',
            sessionKey: 'session-1',
            startedAt: '2026-04-21T16:08:42.000Z',
            text: '',
        },
        startedAt: '2026-04-21T16:08:43.000Z',
        steps: [
            {
                id: 'tool:web',
                kind: 'tool',
                label: 'Using web search',
                status: 'completed',
            },
        ],
    });
});

test('applyReplySnapshot preserves completed progress for the same run status handoff', () => {
    const turn = {
        agentId: 'claw',
        chatId: 'chat-1',
        runId: 'run-1',
        sessionKey: 'session-1',
        startedAt: '2026-04-21T16:08:42.000Z',
    };
    const completed = completeTimelineTurn(
        updateTimelineTurnProgress(startTimelineTurn(emptyTimelineState(), turn), {
            receivedAt: '2026-04-21T16:08:43.000Z',
            step: {
                id: 'tool:web',
                kind: 'tool',
                label: 'Using web search',
                status: 'completed',
            },
            turn,
        }),
        {
            completedAt: '2026-04-21T16:08:46.000Z',
            turn,
        }
    );

    const afterStatus = applyReplySnapshot(completed, {
        agentId: 'claw',
        isThinking: false,
        runId: 'run-1',
        sessionKey: 'session-1',
        startedAt: '2026-04-21T16:08:42.000Z',
        text: 'Done.',
    });

    expect(afterStatus.completedProgress?.reply.runId).toBe('run-1');
});

test('updateTimelineTurnProgress stores volatile active reply steps by run', () => {
    const state = startTimelineTurn(emptyTimelineState(), {
        agentId: 'claw',
        chatId: 'chat-1',
        runId: 'run-1',
        sessionKey: 'session-1',
        startedAt: '2026-04-21T16:08:42.000Z',
    });

    const updated = updateTimelineTurnProgress(state, {
        receivedAt: '2026-04-21T16:08:46.000Z',
        step: {
            detail: 'Searching current documentation',
            id: 'tool:web',
            kind: 'tool',
            label: 'Using web search',
            status: 'active',
        },
        turn: {
            agentId: 'claw',
            chatId: 'chat-1',
            runId: 'run-1',
            sessionKey: 'session-1',
            startedAt: '2026-04-21T16:08:42.000Z',
        },
    });
    const completed = updateTimelineTurnProgress(updated, {
        receivedAt: '2026-04-21T16:08:47.000Z',
        step: {
            detail: 'Found relevant sources',
            id: 'tool:web',
            kind: 'tool',
            label: 'Using web search',
            status: 'completed',
        },
        turn: {
            agentId: 'claw',
            chatId: 'chat-1',
            runId: 'run-1',
            sessionKey: 'session-1',
            startedAt: '2026-04-21T16:08:42.000Z',
        },
    });

    expect(completed.activeReplyProgressStartedAt).toBe('2026-04-21T16:08:46.000Z');
    expect(completed.activeReplySteps).toEqual([
        {
            detail: 'Found relevant sources',
            id: 'tool:web',
            kind: 'tool',
            label: 'Using web search',
            status: 'completed',
        },
    ]);
});

test('applyReplySnapshot clears stale failure and progress state when a newer run becomes active', () => {
    const turn = {
        agentId: 'claw',
        chatId: 'chat-1',
        runId: 'run-1',
        sessionKey: 'session-1',
        startedAt: '2026-04-21T16:08:42.000Z',
    };
    const failed = {
        ...updateTimelineTurnProgress(startTimelineTurn(emptyTimelineState(), turn), {
            step: {
                id: 'tool:web',
                kind: 'tool',
                label: 'Using web search',
                status: 'active',
            },
            turn,
        }),
        activeReply: null,
        failedTurn: {
            error: 'Docker is not running',
            turn,
        },
    };

    const next = applyReplySnapshot(failed, {
        agentId: 'claw',
        isThinking: true,
        runId: 'run-2',
        sessionKey: 'session-1',
        startedAt: '2026-04-21T16:09:42.000Z',
        text: '',
    });

    expect(next.activeReply).toEqual({
        agentId: 'claw',
        isThinking: true,
        runId: 'run-2',
        sessionKey: 'session-1',
        startedAt: '2026-04-21T16:09:42.000Z',
        text: '',
    });
    expect(next.activeReplySteps).toEqual([]);
    expect(next.failedTurn).toBeNull();
});
