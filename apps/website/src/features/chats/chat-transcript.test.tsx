import assert from 'node:assert/strict';
import test from 'node:test';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpLink } from '@trpc/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import type {
    ChatCompletedProgress,
    ChatTurnProgressStep,
} from '../../hooks/chats/chat-timeline-state.ts';
import { SessionDrawerProvider } from '../../hooks/sessions/use-session-drawer.ts';
import { type ChatLogOutput, trpc } from '../../lib/trpc.tsx';
import { ChatTranscript } from './chat-transcript.tsx';
import { ToolStep } from './tool-steps/registry.tsx';

test('ChatTranscript renders hover message metadata and the session action', () => {
    const markup = renderTranscript([
        {
            actor: { id: 'tiny', kind: 'agent' },
            connectsToNext: false,
            connectsToPrevious: false,
            id: 'message-1',
            isFirstInGroup: true,
            kind: 'message',
            message: {
                tavernAgentId: 'tiny',
                content: 'Investigating the issue now.',
                id: 'message-1',
                metadata: {
                    model: 'openrouter/anthropic/claude-3.7-sonnet',
                    usage: {
                        cacheRead: 28_672,
                        input: 524,
                        output: 35,
                        total: 29_231,
                    },
                },
                sender: 'Tiny',
                senderType: 'agent',
                sourceSessionId: 'session-9f83ac',
                sourceSessionKey: 'agent:tiny:discord:channel:session-9f83ac',
                timestamp: '2026-03-31T15:00:00.000Z',
            },
        },
    ]);

    assert.match(markup, /claude-3\.7-sonnet/);
    assert.match(markup, /in 524/);
    assert.match(markup, /cached 29k/);
    assert.match(markup, /total 29k/);
    assert.match(markup, /group-hover:opacity-100/);
    assert.doesNotMatch(markup, /class="[^"]*\bgroup\b[^"]*\bw-full\b/);
    assert.doesNotMatch(markup, /group-focus-within:opacity-100/);
    assert.match(markup, /aria-label="View session"/);
    assert.doesNotMatch(markup, /aria-label="Collapse message"/);
    assert.doesNotMatch(markup, /session 9f83ac/);
});

test('ChatTranscript renders tool calls and agent responses through one surface', () => {
    const markup = renderTranscript([
        {
            actor: { id: 'tiny', kind: 'agent' },
            completedAt: null,
            connectsToNext: true,
            connectsToPrevious: false,
            id: 'tool-1',
            isFirstInGroup: true,
            kind: 'tool',
            sessionKey: 'agent:tiny:session-1',
            spawnedRelationships: [],
            startedAt: '2026-03-31T15:00:00.000Z',
            toolCall: {
                callId: 'call-1',
                facts: [],
                label: 'command -v gog',
                name: 'exec',
                status: 'running',
                summaryParts: ['command -v gog'],
            },
        },
        {
            actor: { id: 'tiny', kind: 'agent' },
            connectsToNext: false,
            connectsToPrevious: true,
            id: 'message-2',
            isFirstInGroup: false,
            kind: 'message',
            message: {
                tavernAgentId: 'tiny',
                content: 'Done.',
                id: 'message-2',
                sender: 'Tiny',
                senderType: 'agent',
                sourceSessionId: null,
                sourceSessionKey: 'agent:tiny:session-1',
                timestamp: '2026-03-31T15:00:01.000Z',
            },
        },
    ]);

    assert.match(markup, /Done\./);
    assert.match(markup, /Worked/);
    assert.doesNotMatch(markup, /Worked for 1 second/);
    assert.match(markup, /aria-expanded="false"/);
});

test('ToolStep renders bash failures through the shell tool renderer', () => {
    const markup = renderToStaticMarkup(
        <ToolStep
            index={0}
            isLast
            row={{
                actor: { id: 'tiny', kind: 'agent' },
                completedAt: '2026-03-31T15:00:05.000Z',
                connectsToNext: false,
                connectsToPrevious: false,
                id: 'tool-timeout',
                isFirstInGroup: true,
                kind: 'tool',
                sessionKey: 'agent:tiny:session-1',
                spawnedRelationships: [],
                startedAt: '2026-03-31T15:00:00.000Z',
                toolCall: {
                    callId: null,
                    facts: [
                        {
                            label: 'Command',
                            tone: 'default',
                            value: "/bin/zsh -lc 'sleep 5'",
                        },
                        {
                            label: 'Reason',
                            tone: 'danger',
                            value: 'command timed out',
                        },
                    ],
                    label: 'bash · sleep 5',
                    name: 'bash',
                    status: 'timeout',
                    summaryParts: ["/bin/zsh -lc 'sleep 5'"],
                },
            }}
        />
    );

    assert.match(markup, /Timed out/);
    assert.doesNotMatch(markup, /command timed out/);
    assert.doesNotMatch(markup, /Status: timeout/);
    assert.doesNotMatch(markup, />Used</);
});

test('ChatTranscript shows completed activity as worked duration', () => {
    const markup = renderTranscript([
        {
            actor: { id: 'tiny', kind: 'agent' },
            completedAt: '2026-03-31T15:02:03.000Z',
            connectsToNext: false,
            connectsToPrevious: false,
            id: 'tool-complete',
            isFirstInGroup: true,
            kind: 'tool',
            sessionKey: 'agent:tiny:session-1',
            spawnedRelationships: [],
            startedAt: '2026-03-31T15:00:00.000Z',
            toolCall: {
                callId: 'call-2',
                facts: [],
                label: 'src/app.tsx',
                name: 'edit',
                status: 'ok',
                summaryParts: ['src/app.tsx'],
            },
        },
    ]);

    assert.match(markup, /Worked for 2 minutes 3 seconds/);
});

test('ChatTranscript does not render preserved completed progress when durable activity exists', () => {
    const rows: ChatRow[] = [
        {
            actor: { id: 'tiny', kind: 'agent' },
            completedAt: '2026-03-31T15:00:04.000Z',
            connectsToNext: true,
            connectsToPrevious: false,
            id: 'tool-complete',
            isFirstInGroup: true,
            kind: 'tool',
            sessionKey: 'agent:tiny:session-1',
            spawnedRelationships: [],
            startedAt: '2026-03-31T15:00:01.000Z',
            toolCall: {
                callId: 'call-2',
                facts: [],
                label: 'weather',
                name: 'weather',
                status: 'ok',
                summaryParts: ['weather'],
            },
        },
        {
            actor: { id: 'tiny', kind: 'agent' },
            connectsToNext: false,
            connectsToPrevious: true,
            id: 'message-agent',
            isFirstInGroup: false,
            kind: 'message',
            message: {
                tavernAgentId: 'tiny',
                content: 'NYC right now: 61F.',
                id: 'message-agent',
                sender: 'Tiny',
                senderType: 'agent',
                sourceSessionId: null,
                sourceSessionKey: 'agent:tiny:session-1',
                timestamp: '2026-03-31T15:00:11.000Z',
            },
        },
    ];
    const completedProgress: ChatCompletedProgress = {
        completedAt: '2026-03-31T15:00:11.000Z',
        reply: {
            agentId: 'tiny',
            isThinking: true,
            runId: 'run-1',
            sessionKey: 'agent:tiny:session-1',
            startedAt: '2026-03-31T15:00:00.000Z',
            text: '',
        },
        startedAt: '2026-03-31T15:00:00.500Z',
        steps: [
            {
                id: 'tool:weather',
                kind: 'tool',
                label: 'Using weather',
                status: 'completed',
            },
        ],
    };

    const markup = renderTranscript(rows, { completedProgress });

    assert.equal(markup.match(/Worked for/g)?.length, 1);
});

test('ChatTranscript prefers durable activity timestamps for completed activity duration', () => {
    const markup = renderTranscript([
        {
            actor: { id: 'profile-1', kind: 'participant' },
            connectsToNext: false,
            connectsToPrevious: false,
            id: 'message-user',
            isFirstInGroup: true,
            kind: 'message',
            message: {
                tavernAgentId: null,
                content: 'Can you try a tool call?',
                id: 'message-user',
                sender: 'You',
                senderType: 'user',
                sourceSessionId: null,
                sourceSessionKey: 'agent:tiny:session-1',
                timestamp: '2026-03-31T15:00:52.000Z',
            },
        },
        {
            actor: { id: 'tiny', kind: 'agent' },
            completedAt: '2026-03-31T15:01:00.002Z',
            connectsToNext: true,
            connectsToPrevious: false,
            id: 'tool-complete',
            isFirstInGroup: true,
            kind: 'tool',
            sessionKey: 'agent:tiny:session-1',
            spawnedRelationships: [],
            startedAt: '2026-03-31T15:01:00.000Z',
            toolCall: {
                callId: 'call-2',
                facts: [],
                label: 'date && pwd',
                name: 'bash',
                status: 'ok',
                summaryParts: ['date && pwd'],
            },
        },
        {
            actor: { id: 'tiny', kind: 'agent' },
            connectsToNext: false,
            connectsToPrevious: true,
            id: 'message-agent',
            isFirstInGroup: false,
            kind: 'message',
            message: {
                tavernAgentId: 'tiny',
                content: 'Tool call worked.',
                id: 'message-agent',
                sender: 'Tiny',
                senderType: 'agent',
                sourceSessionId: null,
                sourceSessionKey: 'agent:tiny:session-1',
                timestamp: '2026-03-31T15:01:03.000Z',
            },
        },
    ]);

    assert.match(markup, /Worked for 3 seconds/);
    assert.doesNotMatch(markup, /Worked for 1 second/);
});

test('ChatTranscript shows a thinking indicator instead of generic worked text when no progress exists', () => {
    const markup = renderActiveTranscript({
        agentId: 'tiny',
        isThinking: true,
        runId: 'run-thinking',
        sessionKey: 'agent:tiny:session-1',
        startedAt: '2026-03-31T15:00:00.000Z',
        text: '',
    });

    assert.match(markup, /Agent is thinking/);
    assert.doesNotMatch(markup, /Working/);
    assert.doesNotMatch(markup, /Worked/);
});

test('ChatTranscript shows a typing indicator instead of generic worked text when no progress exists', () => {
    const markup = renderActiveTranscript({
        agentId: 'tiny',
        isThinking: false,
        runId: 'run-typing',
        sessionKey: 'agent:tiny:session-1',
        startedAt: '2026-03-31T15:00:00.000Z',
        text: '',
    });

    assert.match(markup, /Agent is typing/);
    assert.doesNotMatch(markup, /Working/);
    assert.doesNotMatch(markup, /Worked/);
});

test('ChatTranscript shows active progress through the same thinking steps surface', () => {
    const visibleProgressStartedAt = new Date().toISOString();
    const markup = renderActiveTranscript(
        {
            agentId: 'tiny',
            isThinking: true,
            runId: 'run-progress',
            sessionKey: 'agent:tiny:session-1',
            startedAt: new Date(Date.now() - 3000).toISOString(),
            text: '',
        },
        [
            {
                detail: "I'll inspect the workspace before making changes.",
                id: 'reasoning',
                kind: 'reasoning',
                label: 'Reasoning',
                status: 'active',
            },
            {
                detail: null,
                id: 'tool-1',
                kind: 'tool',
                label: 'Listing files',
                status: 'active',
            },
        ],
        visibleProgressStartedAt
    );

    assert.match(markup, /Working for[\s\S]*>0s</);
    assert.match(markup, /Reasoning\.\.\./);
    assert.match(markup, /I&#x27;ll inspect the workspace before making changes\./);
    assert.match(markup, /Using[\s\S]*Listing files/);
    assert.doesNotMatch(markup, />Running</);
    assert.match(markup, /aria-expanded="true"/);
});

test('ChatTranscript renders active tool progress as one-line status rows', () => {
    const markup = renderActiveTranscript(
        {
            agentId: 'tiny',
            isThinking: true,
            runId: 'run-progress',
            sessionKey: 'agent:tiny:session-1',
            startedAt: new Date(Date.now() - 3000).toISOString(),
            text: '',
        },
        [
            {
                detail: 'start',
                id: 'tool-1',
                kind: 'tool',
                label: 'Using bash...',
                status: 'active',
            },
        ],
        new Date().toISOString()
    );

    assert.match(markup, /Using[\s\S]*bash/);
    assert.doesNotMatch(markup, />Running</);
    assert.doesNotMatch(markup, />start</);
});

test('ChatTranscript keeps live progress in working state when current steps are completed', () => {
    const markup = renderActiveTranscript(
        {
            agentId: 'tiny',
            isThinking: true,
            runId: 'run-progress',
            sessionKey: 'agent:tiny:session-1',
            startedAt: new Date(Date.now() - 3000).toISOString(),
            text: '',
        },
        [
            {
                detail: null,
                id: 'reasoning',
                kind: 'message',
                label: 'Reasoning',
                status: 'completed',
            },
        ],
        new Date().toISOString()
    );

    assert.match(markup, /Working for[\s\S]*>0s</);
    assert.doesNotMatch(markup, /Worked for/);
});

type ChatRow = NonNullable<ChatLogOutput>['rows'][number];

function renderTranscript(
    rows: ChatRow[],
    options: { completedProgress?: ChatCompletedProgress | null } = {}
) {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
            },
        },
    });
    const client = trpc.createClient({
        links: [
            httpLink({
                url: 'http://127.0.0.1:1/trpc',
            }),
        ],
    });

    return renderToStaticMarkup(
        <trpc.Provider client={client} queryClient={queryClient}>
            <QueryClientProvider client={queryClient}>
                <MemoryRouter>
                    <SessionDrawerProvider>
                        <ChatTranscript
                            activeReply={null}
                            completedProgress={options.completedProgress ?? null}
                            rows={rows}
                        />
                    </SessionDrawerProvider>
                </MemoryRouter>
            </QueryClientProvider>
        </trpc.Provider>
    );
}

function renderActiveTranscript(
    activeReply: {
        agentId: string;
        isThinking: boolean;
        runId: string;
        sessionKey: string;
        startedAt: string;
        text: string;
    },
    activeReplySteps: ChatTurnProgressStep[] = [],
    activeReplyProgressStartedAt: string | null = null
) {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
            },
        },
    });
    const client = trpc.createClient({
        links: [
            httpLink({
                url: 'http://127.0.0.1:1/trpc',
            }),
        ],
    });

    return renderToStaticMarkup(
        <trpc.Provider client={client} queryClient={queryClient}>
            <QueryClientProvider client={queryClient}>
                <MemoryRouter>
                    <SessionDrawerProvider>
                        <ChatTranscript
                            activeReply={activeReply}
                            activeReplyProgressStartedAt={activeReplyProgressStartedAt}
                            activeReplySteps={activeReplySteps}
                            rows={[]}
                        />
                    </SessionDrawerProvider>
                </MemoryRouter>
            </QueryClientProvider>
        </trpc.Provider>
    );
}
