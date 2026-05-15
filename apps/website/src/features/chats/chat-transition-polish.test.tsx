import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import {
    isBlockingActiveReply,
    shouldAnimateSyncedChatTimeline,
    shouldReleaseDraftHandoff,
} from './agent-chat-detail.tsx';
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
            activeReplySteps: [],
            failedTurn: null,
            historyLoaded: true,
            timeline: [],
            totalRows: 0,
        })
    ).toBe(false);
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
            activeReplySteps: [],
            failedTurn: null,
            historyLoaded: true,
            timeline: [],
            totalRows: 0,
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
