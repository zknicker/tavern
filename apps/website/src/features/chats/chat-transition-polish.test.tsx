import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { ChatMessage } from '../../components/chats/chat-message.tsx';
import {
    isBlockingActiveReply,
    shouldAnimateSyncedChatTimeline,
    shouldReleaseDraftHandoff,
} from './agent-chat-detail.tsx';
import { AgentPresenceIndicator } from './agent-presence-indicator.tsx';
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
        <ChatTimeline activeReply={null} animate rows={[]} totalMessages={0} />
    );
    const still = renderToStaticMarkup(
        <ChatTimeline activeReply={null} animate={false} rows={[]} totalMessages={0} />
    );

    expect(animated).toContain('animate-float-up');
    expect(still).not.toContain('animate-float-up');
});

test('agent presence indicator keeps a fixed icon box for layout motion', () => {
    const markup = renderToStaticMarkup(<AgentPresenceIndicator activeReply={null} rows={[]} />);

    expect(markup).toContain('height:32px');
    expect(markup).toContain('width:32px');
    expect(markup).toContain('Agent idle');
});

test('chat message entrance animation can be disabled for handoffs', () => {
    const animated = renderToStaticMarkup(
        <ChatMessage animateEnter from="user">
            Hello
        </ChatMessage>
    );
    const still = renderToStaticMarkup(
        <ChatMessage animateEnter={false} from="user">
            Hello
        </ChatMessage>
    );

    expect(animated).toContain('opacity:0;transform');
    expect(still).not.toContain('opacity:0;transform');
});

test('assistant chat message prose keeps the live tail text-line height', () => {
    const assistant = renderToStaticMarkup(<ChatMessage from="assistant">Done</ChatMessage>);
    const user = renderToStaticMarkup(<ChatMessage from="user">Done</ChatMessage>);

    expect(assistant).not.toContain('py-2');
    expect(assistant).toContain('min-h-5');
    expect(user).toContain('py-2');
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
            activeTurn: null,
            failedTurn: null,
            historyLoaded: true,
            timeline: [],
            totalMessages: 0,
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
            activeTurn: null,
            failedTurn: null,
            historyLoaded: true,
            timeline: [],
            totalMessages: 0,
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
            activeTurn: null,
            failedTurn: null,
            historyLoaded: true,
            timeline: [],
            totalMessages: 0,
        })
    ).toBe(true);
});

test('draft handoff waits when the loaded real chat only has the user message', () => {
    expect(
        shouldReleaseDraftHandoff({
            activeReply: null,
            activeTurn: null,
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
            totalMessages: 1,
        })
    ).toBe(false);
});

test('draft handoff releases when no active reply remains after terminal history loads', () => {
    expect(
        shouldReleaseDraftHandoff({
            activeReply: null,
            activeTurn: null,
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
            totalMessages: 1,
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
