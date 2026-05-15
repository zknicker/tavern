import { expect, test } from 'bun:test';
import {
    applyLogSnapshot,
    applyReplySnapshot,
    clearTimelineTurn,
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
    expect(next.timeline).toHaveLength(1);
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

test('updateTimelineTurnProgress stores volatile active reply steps by run', () => {
    const state = startTimelineTurn(emptyTimelineState(), {
        agentId: 'claw',
        chatId: 'chat-1',
        runId: 'run-1',
        sessionKey: 'session-1',
        startedAt: '2026-04-21T16:08:42.000Z',
    });

    const updated = updateTimelineTurnProgress(state, {
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
