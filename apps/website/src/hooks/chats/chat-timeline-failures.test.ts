import { expect, test } from 'bun:test';
import {
    applyLogSnapshot,
    applyReplySnapshot,
    emptyTimelineState,
    failTimelineTurn,
    startTimelineTurn,
    updateTimelineTurnProgress,
} from './chat-timeline-state.ts';

function failureLog() {
    return {
        limit: 100,
        offset: 0,
        rows: [
            {
                actor: null,
                connectsToNext: false,
                connectsToPrevious: false,
                id: 'message-1',
                isFirstInGroup: true,
                kind: 'message' as const,
                message: {
                    content: 'OpenClaw turn failed: Docker is not running',
                    id: 'message-1',
                    metadata: {
                        tavern: {
                            turnFailure: {
                                runId: 'run-1',
                            },
                        },
                        isError: true,
                        stopReason: 'error',
                    },
                    sender: 'OpenClaw',
                    senderType: 'system' as const,
                    sourceSessionId: null,
                    sourceSessionKey: 'session-1',
                    timestamp: '2026-04-21T16:08:49.000Z',
                },
            },
        ],
        total: 1,
    };
}

test('failTimelineTurn clears thinking and stores a terminal error', () => {
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

    const failed = failTimelineTurn(state, {
        error: 'Docker is not running',
        turn,
    });

    expect(failed.activeReply).toBeNull();
    expect(failed.activeReplySteps).toEqual([]);
    expect(failed.failedTurn?.error).toBe('Docker is not running');
});

test('applyLogSnapshot clears thinking when the durable error message lands', () => {
    const turn = {
        agentId: 'claw',
        chatId: 'chat-1',
        runId: 'run-1',
        sessionKey: 'session-1',
        startedAt: '2026-04-21T16:08:42.000Z',
    };
    const failed = failTimelineTurn(startTimelineTurn(emptyTimelineState(), turn), {
        error: 'Docker is not running',
        turn,
    });
    const next = applyLogSnapshot(failed, failureLog());

    expect(next.failedTurn).toBeNull();
    expect(next.activeReply).toBeNull();
    expect(next.activeReplySteps).toEqual([]);
    expect(next.timeline).toHaveLength(1);
});

test('applyReplySnapshot does not restore thinking when the durable error message is visible', () => {
    const state = applyLogSnapshot(emptyTimelineState(), failureLog());
    const next = applyReplySnapshot(state, {
        agentId: 'claw',
        runId: 'run-1',
        sessionKey: 'session-1',
        startedAt: '2026-04-21T16:08:42.000Z',
    });

    expect(next.activeReply).toBeNull();
});
