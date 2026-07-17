import { expect, test } from 'bun:test';
import { developmentChatDemoIds } from '@tavern/api/development-chat-demos';
import { renderToStaticMarkup } from 'react-dom/server';
import { ChatMessage } from '../../components/chats/chat-message.tsx';
import type { ChatTurn } from '../../hooks/chats/chat-timeline-state.ts';
import {
    chatDetailLogLimit,
    demoChannelLogLimit,
    getChatDetailLogLimit,
    isBlockingActiveTurn,
    shouldReleaseDraftHandoff,
} from './agent-chat-detail.tsx';
import { AgentStatusIndicator } from './agent-status-indicator.tsx';
import { resolveDraftHandoffFrame } from './chat-draft-detail.tsx';

test('chat detail cold-open loads a narrow transcript tail', () => {
    expect(chatDetailLogLimit).toBeLessThanOrEqual(30);
});

test('demo channel loads enough messages to show representative coverage', () => {
    expect(getChatDetailLogLimit(developmentChatDemoIds.demo)).toBe(demoChannelLogLimit);
    expect(demoChannelLogLimit).toBe(48);
    expect(getChatDetailLogLimit('cht_normal')).toBe(chatDetailLogLimit);
});

test('agent status indicator keeps a fixed icon box for layout motion', () => {
    const markup = renderToStaticMarkup(
        <AgentStatusIndicator activeReply={null} character="robot" rows={[]} />
    );

    expect(markup).toContain('height:32px');
    expect(markup).toContain('width:32px');
    expect(markup).toContain('Agent idle');
});

test('agent status indicator leaves emotion changes to the eye spring', () => {
    const idleMarkup = renderToStaticMarkup(
        <AgentStatusIndicator activeReply={null} character="robot" rows={[]} />
    );
    const thinkingMarkup = renderToStaticMarkup(
        <AgentStatusIndicator
            activeReply={{
                agentId: 'agent-1',
                isThinking: true,
                runId: 'run-1',
                sessionKey: 'session-1',
                startedAt: '2026-05-13T12:00:00.000Z',
                text: '',
            }}
            character="robot"
            rows={[]}
        />
    );

    expect(getFirstPathData(thinkingMarkup)).toBe(getFirstPathData(idleMarkup));
    expect(thinkingMarkup).toContain('Agent is thinking');
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

function getFirstPathData(markup: string) {
    return /<path d="([^"]+)"/.exec(markup)?.[1] ?? null;
}

test('chat message prose uses the shadcn bubble content styling', () => {
    const assistant = renderToStaticMarkup(<ChatMessage from="assistant">Done</ChatMessage>);
    const user = renderToStaticMarkup(<ChatMessage from="user">Done</ChatMessage>);

    for (const markup of [assistant, user]) {
        expect(markup).toContain('data-slot="bubble-content"');
        expect(markup).toContain('py-2');
        expect(markup).toContain('leading-relaxed');
    }

    // Every message — the owner's included — reads as left-aligned ghost text
    // in one Slack-style roster; only data-from tells the senders apart.
    for (const markup of [assistant, user]) {
        expect(markup).toContain('rounded-xl');
        expect(markup).toContain('data-variant="ghost"');
    }
    expect(assistant).toContain('data-from="assistant"');
    expect(user).toContain('data-from="user"');
});

test('chat message wraps long pasted tokens inside the bubble', () => {
    const longToken = `{"client_secret":"${'x'.repeat(256)}"}`;

    for (const from of ['user', 'assistant'] as const) {
        const markup = renderToStaticMarkup(<ChatMessage from={from}>{longToken}</ChatMessage>);

        expect(markup).toContain('data-slot="bubble"');
        expect(markup).toContain('max-w-[80%]');
        expect(markup).toContain('min-w-0');
        expect(markup).toContain('max-w-full');
        expect(markup).toContain('wrap-break-word');
    }
});

test('draft handoff waits while the accepted turn is still blank thinking', () => {
    expect(
        shouldReleaseDraftHandoff({
            activeReplies: [
                {
                    agentId: 'agent-1',
                    isThinking: true,
                    runId: 'run-1',
                    sessionKey: 'session-1',
                    startedAt: '2026-05-13T12:00:00.000Z',
                    text: '',
                },
            ],
            activeTurns: [],
            failedTurns: [],
            historyLoaded: true,
            timeline: [],
            totalMessages: 0,
            terminalRunIds: [],
            turnEvidence: {},
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
            activeReplies: [
                {
                    agentId: 'agent-1',
                    isThinking: true,
                    runId: 'run-1',
                    sessionKey: 'session-1',
                    startedAt: '2026-05-13T12:00:01.000Z',
                    text: '',
                },
            ],
            activeTurns: [],
            failedTurns: [],
            historyLoaded: true,
            timeline: [],
            totalMessages: 0,
            terminalRunIds: [],
            turnEvidence: {},
        },
    });

    expect(frame.activeReplies[0]?.runId).toBe('run-1');
});

test('draft handoff releases when the active reply has visible text', () => {
    expect(
        shouldReleaseDraftHandoff({
            activeReplies: [
                {
                    agentId: 'agent-1',
                    isThinking: false,
                    runId: 'run-1',
                    sessionKey: 'session-1',
                    startedAt: '2026-05-13T12:00:00.000Z',
                    text: 'Done.',
                },
            ],
            activeTurns: [],
            failedTurns: [],
            historyLoaded: true,
            timeline: [],
            totalMessages: 0,
            terminalRunIds: [],
            turnEvidence: {},
        })
    ).toBe(true);
});

test('draft handoff waits when the loaded real chat only has the user message', () => {
    expect(
        shouldReleaseDraftHandoff({
            activeReplies: [],
            activeTurns: [],
            failedTurns: [],
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
            terminalRunIds: [],
            turnEvidence: {},
        })
    ).toBe(false);
});

test('draft handoff releases when no active reply remains after terminal history loads', () => {
    expect(
        shouldReleaseDraftHandoff({
            activeReplies: [],
            activeTurns: [],
            failedTurns: [],
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
            terminalRunIds: [],
            turnEvidence: {},
        })
    ).toBe(true);
});

test('visible non-thinking fallback replies do not keep the composer blocked', () => {
    expect(
        isBlockingActiveTurn({
            activeReplies: [{ isThinking: false }],
            activeTurns: [],
            agentsPending: false,
        })
    ).toBe(false);

    expect(
        isBlockingActiveTurn({
            activeReplies: [{ isThinking: true }],
            activeTurns: [],
            agentsPending: false,
        })
    ).toBe(true);
});

test('active tool-only turns keep the reply marked active', () => {
    const activeTurns: ChatTurn[] = [
        {
            agentId: 'agent-1',
            chatId: 'chat-1',
            runId: 'run-1',
            sessionKey: 'session-1',
            startedAt: '2026-05-13T12:00:00.000Z',
        },
    ];
    expect(
        isBlockingActiveTurn({
            activeReplies: [],
            activeTurns,
            agentsPending: false,
        })
    ).toBe(true);
});

test('quiet peer-evaluation turns never block the composer', () => {
    const activeTurns: ChatTurn[] = [
        {
            agentId: 'agent-1',
            chatId: 'chat-1',
            runId: 'run-1',
            sessionKey: 'session-1',
            startedAt: '2026-05-13T12:00:00.000Z',
            trigger: 'evaluation',
        },
    ];
    expect(
        isBlockingActiveTurn({
            activeReplies: [{ isThinking: true, text: '', trigger: 'evaluation' as const }],
            activeTurns,
            agentsPending: false,
        })
    ).toBe(false);
});
