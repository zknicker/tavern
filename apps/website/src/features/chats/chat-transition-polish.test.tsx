import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import {
    isBlockingActiveReply,
    shouldAnimateSyncedChatTimeline,
    shouldReleaseDraftHandoff,
} from './agent-chat-detail.tsx';
import { resolveDraftHandoffFrame } from './chat-draft-detail.tsx';
import { ChatTimeline } from './chat-timeline.tsx';

test('synced timeline does not replay entrance animation after optimistic draft handoff', () => {
    expect(
        shouldAnimateSyncedChatTimeline({
            chatId: 'chat-real',
            draftRealChatId: 'chat-real',
        })
    ).toBe(false);
});

test('synced timeline still animates for normal chat transcript loads', () => {
    expect(
        shouldAnimateSyncedChatTimeline({
            chatId: 'chat-real',
            draftRealChatId: null,
        })
    ).toBe(true);
});

test('chat timeline animation is explicit and can be disabled', () => {
    const animated = renderToStaticMarkup(
        <ChatTimeline activeReply={null} animate rows={[]} totalRows={0} />
    );
    const still = renderToStaticMarkup(
        <ChatTimeline activeReply={null} animate={false} rows={[]} totalRows={0} />
    );

    expect(animated).toContain('animate-float-up');
    expect(still).not.toContain('animate-float-up');
});

test('draft handoff waits while the accepted turn is still blank thinking', () => {
    expect(
        shouldReleaseDraftHandoff({
            activeReply: {
                agentId: 'agent-1',
                isThinking: true,
                runId: 'run-1',
                sessionKey: 'session-1',
                startedAt: '2026-05-13T12:00:00.000Z',
                text: '',
            },
            failedTurn: null,
            historyLoaded: true,
            timeline: [],
            totalRows: 0,
        })
    ).toBe(false);
});

test('draft handoff forwards the real active reply once the turn starts', () => {
    const frame = resolveDraftHandoffFrame({
        draftActiveReply: {
            agentId: 'agent-1',
            isThinking: true,
            runId: 'draft-message-1',
            sessionKey: 'draft-chat-1',
            startedAt: '2026-05-13T12:00:00.000Z',
            text: '',
        },
        handoffState: {
            activeReply: {
                agentId: 'agent-1',
                isThinking: true,
                runId: 'run-1',
                sessionKey: 'session-1',
                startedAt: '2026-05-13T12:00:01.000Z',
                text: '',
            },
            failedTurn: null,
            historyLoaded: true,
            timeline: [],
            totalRows: 0,
        },
    });

    expect(frame.activeReply?.runId).toBe('run-1');
});

test('draft handoff releases when the active reply has visible text', () => {
    expect(
        shouldReleaseDraftHandoff({
            activeReply: {
                agentId: 'agent-1',
                isThinking: false,
                runId: 'run-1',
                sessionKey: 'session-1',
                startedAt: '2026-05-13T12:00:00.000Z',
                text: 'Done.',
            },
            failedTurn: null,
            historyLoaded: true,
            timeline: [],
            totalRows: 0,
        })
    ).toBe(true);
});

test('draft handoff waits when the loaded real chat only has the user message', () => {
    expect(
        shouldReleaseDraftHandoff({
            activeReply: null,
            failedTurn: null,
            historyLoaded: true,
            timeline: [
                {
                    actor: { id: 'user-1', kind: 'participant' },
                    connectsToNext: false,
                    connectsToPrevious: false,
                    id: 'msg-user',
                    isFirstInGroup: true,
                    kind: 'message',
                    message: {
                        content: 'Hello',
                        id: 'msg-user',
                        metadata: undefined,
                        sender: 'You',
                        senderType: 'user',
                        sourceSessionId: null,
                        sourceSessionKey: '',
                        tavernAgentId: null,
                        timestamp: '2026-05-13T12:00:00.000Z',
                    },
                },
            ],
            totalRows: 1,
        })
    ).toBe(false);
});

test('draft handoff releases when no active reply remains after terminal history loads', () => {
    expect(
        shouldReleaseDraftHandoff({
            activeReply: null,
            failedTurn: null,
            historyLoaded: true,
            timeline: [
                {
                    actor: { id: 'agent-1', kind: 'agent' },
                    connectsToNext: false,
                    connectsToPrevious: false,
                    id: 'msg-agent',
                    isFirstInGroup: true,
                    kind: 'message',
                    message: {
                        content: 'Done.',
                        id: 'msg-agent',
                        metadata: undefined,
                        sender: 'Agent',
                        senderType: 'agent',
                        sourceSessionId: null,
                        sourceSessionKey: 'session-1',
                        tavernAgentId: 'agent-1',
                        timestamp: '2026-05-13T12:00:02.000Z',
                    },
                },
            ],
            totalRows: 1,
        })
    ).toBe(true);
});

test('visible non-thinking fallback replies do not keep the composer blocked', () => {
    expect(
        isBlockingActiveReply({
            activeReply: {
                isThinking: false,
            },
            agentsPending: false,
        })
    ).toBe(false);

    expect(
        isBlockingActiveReply({
            activeReply: {
                isThinking: true,
            },
            agentsPending: false,
        })
    ).toBe(true);
});
