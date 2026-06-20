import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { ChatMessage } from '../../components/chats/chat-message.tsx';
import {
    chatDetailLogLimit,
    isBlockingActiveTurn,
    shouldReleaseDraftHandoff,
} from './agent-chat-detail.tsx';
import { AgentPresenceIndicator } from './agent-presence-indicator.tsx';
import { resolveActivePresenceVerb } from './chat-active-presence-verb.ts';
import { resolveDraftHandoffFrame } from './chat-draft-detail.tsx';
import { getSteerableRunId } from './chat-steering.ts';

test('chat detail cold-open loads a narrow transcript tail', () => {
    expect(chatDetailLogLimit).toBeLessThanOrEqual(30);
});

test('agent presence indicator keeps a fixed icon box for layout motion', () => {
    const markup = renderToStaticMarkup(<AgentPresenceIndicator activeReply={null} rows={[]} />);

    expect(markup).toContain('height:32px');
    expect(markup).toContain('width:32px');
    expect(markup).toContain('Agent idle');
});

test('agent presence indicator leaves emotion changes to the eye spring', () => {
    const idleMarkup = renderToStaticMarkup(
        <AgentPresenceIndicator activeReply={null} rows={[]} />
    );
    const thinkingMarkup = renderToStaticMarkup(
        <AgentPresenceIndicator
            activeReply={{
                agentId: 'agent-1',
                isThinking: true,
                runId: 'run-1',
                sessionKey: 'session-1',
                startedAt: '2026-05-13T12:00:00.000Z',
                text: '',
            }}
            rows={[]}
        />
    );

    expect(getFirstPathData(thinkingMarkup)).toBe(getFirstPathData(idleMarkup));
    expect(thinkingMarkup).toContain('Agent is thinking');
});

test('active presence verb stays stable across draft run reconciliation', () => {
    const draftVerb = resolveActivePresenceVerb({
        activeReply: {
            agentId: 'agent-1',
            isThinking: true,
            runId: 'draft-message-1',
            sessionKey: 'draft-chat-1',
            startedAt: '2026-05-13T12:00:00.000Z',
            text: '',
        },
        currentVerb: null,
    });

    expect(
        resolveActivePresenceVerb({
            activeReply: {
                agentId: 'agent-1',
                isThinking: true,
                runId: 'run-1',
                sessionKey: 'session-1',
                startedAt: '2026-05-13T12:00:01.000Z',
                text: '',
            },
            currentVerb: draftVerb,
        })
    ).toBe(draftVerb);
    expect(resolveActivePresenceVerb({ activeReply: null, currentVerb: draftVerb })).toBeNull();
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

test('assistant chat message prose keeps the live tail text-line height', () => {
    const assistant = renderToStaticMarkup(<ChatMessage from="assistant">Done</ChatMessage>);
    const user = renderToStaticMarkup(<ChatMessage from="user">Done</ChatMessage>);

    expect(assistant).not.toContain('py-2');
    expect(assistant).toContain('min-h-5');
    expect(user).toContain('py-2');
});

test('chat message wraps long pasted tokens inside the bubble', () => {
    const longToken = `{"client_secret":"${'x'.repeat(256)}"}`;

    for (const from of ['user', 'assistant'] as const) {
        const markup = renderToStaticMarkup(<ChatMessage from={from}>{longToken}</ChatMessage>);

        expect(markup).toContain('min-w-0 max-w-[80%]');
        expect(markup).toContain('min-w-0 max-w-full');
        expect(markup).toContain('[overflow-wrap:anywhere]');
    }
});

test('chat message meta row reserves flow height', () => {
    const markup = renderToStaticMarkup(
        <ChatMessage actions={<button type="button">Copy</button>} from="user" time="12:00">
            Done
        </ChatMessage>
    );

    expect(markup).toContain('opacity-0');
    expect(markup).toContain('min-h-7');
    expect(markup).not.toContain('absolute');
    expect(markup).not.toContain('top-full');
});

test('chat message disabled copy action keeps the live reply gutter', () => {
    const markup = renderToStaticMarkup(
        <ChatMessage
            actions={
                <button disabled type="button">
                    Copy
                </button>
            }
            from="assistant"
        >
            Streaming
        </ChatMessage>
    );

    expect(markup).toContain('min-h-7');
    expect(markup).toContain('disabled=""');
    expect(markup).not.toContain('absolute');
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
        isBlockingActiveTurn({
            activeReply: {
                isThinking: false,
            },
            activeTurn: null,
            agentsPending: false,
        })
    ).toBe(false);

    expect(
        isBlockingActiveTurn({
            activeReply: {
                isThinking: true,
            },
            activeTurn: null,
            agentsPending: false,
        })
    ).toBe(true);
});

test('active tool-only turns keep the composer in queue mode', () => {
    expect(
        isBlockingActiveTurn({
            activeReply: null,
            activeTurn: {
                agentId: 'agent-1',
                chatId: 'chat-1',
                runId: 'run-1',
                sessionKey: 'session-1',
                startedAt: '2026-05-13T12:00:00.000Z',
            },
            agentsPending: false,
        })
    ).toBe(true);
});

test('steering is available only before final reply text streams', () => {
    const activeTurn = {
        agentId: 'agent-1',
        chatId: 'chat-1',
        runId: 'run-1',
        sessionKey: 'session-1',
        startedAt: '2026-05-13T12:00:00.000Z',
    };

    expect(getSteerableRunId({ activeReply: null, activeTurn })).toBe('run-1');
    expect(
        getSteerableRunId({
            activeReply: {
                runId: 'run-1',
                text: '',
            },
            activeTurn,
        })
    ).toBe('run-1');
    expect(
        getSteerableRunId({
            activeReply: {
                runId: 'run-1',
                text: 'Canada is too broad.',
            },
            activeTurn,
        })
    ).toBeNull();
    expect(
        getSteerableRunId({
            activeReply: {
                runId: 'run-1',
                text: '',
            },
            activeTurn,
            rows: [
                {
                    actor: { id: 'agent-1', kind: 'agent' },
                    connectsToNext: false,
                    connectsToPrevious: false,
                    id: 'act_run-1_message_1',
                    isFirstInGroup: true,
                    kind: 'message',
                    message: {
                        actor: { id: 'agent-1', kind: 'agent' },
                        content: 'Canada is too broad.',
                        id: 'act_run-1_message_1',
                        metadata: { runtime: { runId: 'run-1' } },
                        sender: 'agent-1',
                        senderType: 'agent',
                        sourceSessionId: null,
                        sourceSessionKey: 'session-1',
                        tavernAgentId: 'agent-1',
                        timestamp: '2026-05-13T12:00:01.000Z',
                    },
                },
            ],
        })
    ).toBeNull();
});
