import assert from 'node:assert/strict';
import test from 'node:test';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpLink } from '@trpc/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { DevModeProvider } from '../../components/dev-mode-provider.tsx';
import { mergeTimelineMessages } from '../../hooks/chats/chat-timeline-messages.ts';
import type { ChatActiveReply } from '../../hooks/chats/chat-timeline-state.ts';
import { type ChatLogOutput, trpc } from '../../lib/trpc.tsx';
import { ArtifactLogEntry } from '../sessions/log/event-entry/artifact-entry.tsx';
import { ToolDrawerBody } from '../sessions/tools/tool-drawer-body.tsx';
import { AgentDrawerProvider } from './agent-drawer-context.tsx';
import { ChatTranscript } from './chat-transcript.tsx';
import { groupAgentItems } from './chat-transcript-item-utils.ts';
import type { TranscriptItem } from './chat-transcript-model.ts';
import { SystemStep } from './chat-transcript-system-step.tsx';
import { filterPaneSegments, getActiveReplyDisplayText } from './chat-transcript-turn.tsx';
import { ChatTurnItems } from './chat-turn-drawer.tsx';
import { ToolStep } from './tool-steps/registry.tsx';

test('ChatTranscript renders hover time and copy action without session or usage badges', () => {
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

    assert.doesNotMatch(markup, /claude-3\.7-sonnet/);
    assert.doesNotMatch(markup, /in 524/);
    assert.doesNotMatch(markup, /cached 29k/);
    assert.doesNotMatch(markup, /total 29k/);
    assert.match(markup, /data-slot="message-scroller"/);
    assert.match(markup, /data-slot="message-scroller-item"/);
    assert.match(markup, /data-slot="bubble-content"/);
    assert.doesNotMatch(markup, /opacity:0;transform/);
    assert.match(markup, /aria-label="Copy message"/);
    assert.doesNotMatch(markup, /aria-label="View session"/);
    assert.doesNotMatch(markup, /Agent idle/);
    assert.doesNotMatch(markup, /aria-label="Collapse message"/);
    assert.doesNotMatch(markup, /session 9f83ac/);
});

test('ChatTranscript keeps the detail lane capped', () => {
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
                content: 'Using the available width.',
                id: 'message-1',
                sender: 'Tiny',
                senderType: 'agent',
                sourceSessionId: 'session-1',
                sourceSessionKey: 'agent:tiny:session-1',
                timestamp: '2026-07-01T18:00:00.000Z',
            },
        },
    ]);

    assert.match(markup, /relative mx-auto min-h-full w-full max-w-\[60rem\]/);
});

test('ChatTranscript animates only local optimistic user messages', () => {
    const localTimeline = mergeTimelineMessages({
        limit: 10,
        logged: undefined,
        messages: [
            {
                content: 'Can you check this?',
                id: 'msg-local',
                timestamp: '2026-03-31T15:00:00.000Z',
            },
        ],
    });
    const markup = renderTranscript(localTimeline?.rows ?? []);

    assert.match(markup, /Can you check this\?/);
    assert.match(markup, /data-slot="message"/);
    // The owner's own optimistic message anchors right (secondary bubble).
    assert.match(markup, /style="transform-origin:bottom right;opacity:0;transform/);
});

test('ChatTranscript renders chat markdown headings and inline markup in message text', () => {
    const markup = renderTranscript([
        {
            actor: { id: 'tiny', kind: 'agent' },
            connectsToNext: false,
            connectsToPrevious: false,
            id: 'message-markdown',
            isFirstInGroup: true,
            kind: 'message',
            message: {
                tavernAgentId: 'tiny',
                content:
                    '# Test\n\n## Test 2\n\n### Test 3\nI use **gpt-5.4-mini**, *carefully*, with `OPENAI_API_KEY`, [OpenAI](https://openai.com), www.example.com, <u>raw</u>, and [bad](javascript:alert(1)).',
                id: 'message-markdown',
                sender: 'Tiny',
                senderType: 'agent',
                sourceSessionId: null,
                sourceSessionKey: '',
                timestamp: '2026-03-31T15:00:00.000Z',
            },
        },
    ]);

    assert.match(markup, /<h1 class="[^"]*">Test<\/h1>/);
    assert.match(markup, /<h2 class="[^"]*">Test 2<\/h2>/);
    assert.match(markup, /<h3 class="[^"]*">Test 3<\/h3>/);
    assert.match(markup, /<strong class="font-semibold">gpt-5\.4-mini<\/strong>/);
    assert.match(markup, /<em class="italic">carefully<\/em>/);
    assert.match(
        markup,
        /<code class="[^"]*\[overflow-wrap:anywhere\][^"]*">OPENAI_API_KEY<\/code>/
    );
    assert.match(markup, /href="https:\/\/openai\.com\/"/);
    assert.match(markup, /href="https:\/\/www\.example\.com\/"/);
    assert.match(markup, />www\.example\.com<\/a>/);
    assert.match(markup, /&lt;u&gt;raw&lt;\/u&gt;/);
    assert.doesNotMatch(markup, /# Test/);
    assert.doesNotMatch(markup, /href="javascript:/);
});

test('ChatTranscript renders image attachments in a fluid media frame', () => {
    const markup = renderTranscript([
        {
            actor: { id: 'profile-1', kind: 'participant' },
            connectsToNext: false,
            connectsToPrevious: false,
            id: 'message-image',
            isFirstInGroup: true,
            kind: 'message',
            message: {
                tavernAgentId: null,
                attachments: [
                    {
                        dataBase64: 'iVBORw0KGgo=',
                        filename: 'screenshot.png',
                        height: 768,
                        mediaType: 'image/png',
                        sizeBytes: 12_345,
                        type: 'inline',
                        width: 1024,
                    },
                ],
                content: 'Can you inspect this?',
                id: 'message-image',
                sender: 'You',
                senderType: 'user',
                sourceSessionId: null,
                sourceSessionKey: 'agent:tiny:session-1',
                timestamp: '2026-03-31T15:00:00.000Z',
            },
        },
    ]);

    assert.match(markup, /aria-label="Open screenshot\.png"/);
    assert.match(markup, /size-16/);
    assert.doesNotMatch(markup, /bg-surface-2/);
    assert.doesNotMatch(markup, /File reference/);
});

test('ChatTranscript renders active replies through the chat message shell', () => {
    const markup = renderActiveTranscript({
        agentId: 'tiny',
        isThinking: false,
        runId: 'run-1',
        sessionKey: 'agent:tiny:session-1',
        startedAt: '2026-03-31T15:00:00.000Z',
        text: 'Done.',
    });

    assert.match(markup, /data-slot="message"/);
    assert.match(markup, /data-slot="bubble"/);
    assert.match(markup, /group\/turn w-full gap-3 py-1\.5/);
    assert.doesNotMatch(markup, /group\/turn w-full px-3 py-1\.5/);
    assert.match(markup, /gap-0\.5 pt-0\.5/);
    assert.match(markup, /transform-origin:bottom left/);
    assert.doesNotMatch(markup, /pb-6/);
    assert.doesNotMatch(markup, /style="transform-origin:bottom left;opacity:0;transform/);
});

test('ChatTranscript renders completed active replies as one full message block', () => {
    const markup = renderActiveTranscript({
        agentId: 'tiny',
        completedAt: '2026-03-31T15:00:03.000Z',
        isThinking: false,
        runId: 'run-1',
        sessionKey: 'agent:tiny:session-1',
        startedAt: '2026-03-31T15:00:00.000Z',
        text: 'First line.\nSecond line.\nThird line.',
    });

    assert.match(markup, /First line\./);
    assert.match(markup, /Second line\./);
    assert.match(markup, /Third line\./);
    assert.match(markup, /data-slot="message"/);
    assert.match(markup, /data-slot="bubble"/);
    assert.doesNotMatch(markup, /chat-streaming-text-unit/);
});

test('ChatTranscript renders loaded multiline assistant replies as one message block', () => {
    const markup = renderTranscript([
        {
            actor: { id: 'tiny', kind: 'agent' },
            connectsToNext: false,
            connectsToPrevious: false,
            id: 'message-multiline',
            isFirstInGroup: true,
            kind: 'message',
            message: {
                tavernAgentId: 'tiny',
                content: 'First line.\nSecond line.\nThird line.',
                id: 'message-multiline',
                sender: 'Tiny',
                senderType: 'agent',
                sourceSessionId: null,
                sourceSessionKey: 'agent:tiny:session-1',
                timestamp: '2026-03-31T15:00:00.000Z',
            },
        },
    ]);

    assert.match(markup, /First line\./);
    assert.match(markup, /Second line\./);
    assert.match(markup, /Third line\./);
    assert.match(markup, /data-slot="message"/);
    assert.match(markup, /data-slot="bubble"/);
    assert.doesNotMatch(markup, /chat-streaming-text-unit/);
});

test('active reply display text ignores invisible streaming edge whitespace', () => {
    assert.equal(getActiveReplyDisplayText('\n\nDone.\n\n'), 'Done.');
});

test('ChatTranscript keeps tool calls out of the pane and in the turn body', () => {
    const rows: ChatRow[] = [
        {
            actor: { id: 'tiny', kind: 'agent' },
            completedAt: '2026-03-31T15:00:01.000Z',
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
    ];
    const markup = renderTranscript(rows);

    assert.match(markup, /Done\./);
    assert.doesNotMatch(markup, /Worked/);
    assert.doesNotMatch(markup, /Agent idle/);
    // The pane is prose-only; tool work renders in the turn drawer instead.
    assert.doesNotMatch(markup, /aria-expanded/);
    assert.doesNotMatch(markup, /command -v gog/);

    const turnBody = renderTurnBody(rows);

    assert.match(turnBody, /command -v gog/);
    // The drawer opens work groups by default.
    assert.match(turnBody, /aria-expanded="true"/);
});

test('ChatTranscript labels recovered tool failures without making the final reply look failed', () => {
    const rows: ChatRow[] = [
        {
            actor: { id: 'tiny', kind: 'agent' },
            completedAt: '2026-03-31T15:00:01.000Z',
            connectsToNext: true,
            connectsToPrevious: false,
            id: 'tool-failed-read',
            isFirstInGroup: true,
            kind: 'tool',
            sessionKey: 'agent:tiny:session-1',
            spawnedRelationships: [],
            startedAt: '2026-03-31T15:00:00.000Z',
            toolCall: {
                callId: 'call-failed-read',
                facts: [{ label: 'Error', tone: 'danger', value: 'HTTP 400' }],
                label: 'read · bad-upload.png',
                name: 'read_file',
                status: 'error',
                summaryParts: ['bad-upload.png'],
            },
        },
        {
            actor: { id: 'tiny', kind: 'agent' },
            completedAt: '2026-03-31T15:00:02.000Z',
            connectsToNext: true,
            connectsToPrevious: true,
            id: 'tool-success-write',
            isFirstInGroup: false,
            kind: 'tool',
            sessionKey: 'agent:tiny:session-1',
            spawnedRelationships: [],
            startedAt: '2026-03-31T15:00:01.000Z',
            toolCall: {
                callId: 'call-success-write',
                facts: [],
                label: 'write · Memory/Notes.md',
                name: 'write_file',
                status: 'ok',
                summaryParts: ['Memory/Notes.md'],
            },
        },
        {
            actor: { id: 'tiny', kind: 'agent' },
            connectsToNext: false,
            connectsToPrevious: true,
            id: 'message-recovered',
            isFirstInGroup: false,
            kind: 'message',
            message: {
                tavernAgentId: 'tiny',
                content: 'Done.',
                id: 'message-recovered',
                sender: 'Tiny',
                senderType: 'agent',
                sourceSessionId: null,
                sourceSessionKey: 'agent:tiny:session-1',
                timestamp: '2026-03-31T15:00:03.000Z',
            },
        },
    ];
    const markup = renderTranscript(rows);

    assert.match(markup, /Done\./);
    assert.doesNotMatch(markup, /Final reply failed/);
    assert.doesNotMatch(markup, /Recovered after failed file read/);

    const turnBody = renderTurnBody(rows);

    assert.match(turnBody, /Recovered after failed file read: bad-upload\.png/);
});

test('ChatTranscript renders chart widgets inline', () => {
    const markup = renderTranscript([widgetRow('ui-chart')]);

    assert.match(markup, /Quarterly Revenue/);
    assert.match(markup, /\$15,500/);
    assert.match(markup, /max-w-\[46rem\]/);
    assert.match(markup, /aspect-ratio:21 \/ 9/);
    assert.match(markup, /relative w-full overflow-visible/);
    assert.doesNotMatch(markup, /Widget unavailable/);
    assert.doesNotMatch(markup, /aria-expanded/);
    assert.doesNotMatch(markup, /aria-pressed/);
    assert.doesNotMatch(markup, /Expand chart/);
});

test('ChatTranscript renders table widget matrix shorthand', () => {
    const row = widgetRow('ui-table-matrix');

    if (row.kind !== 'widget') {
        throw new Error('Expected widget row.');
    }

    const markup = renderTranscript([
        {
            ...row,
            widget: {
                ...row.widget,
                component: 'tavern.widget.table',
                fallbackText: 'Table: State, Population',
                props: {
                    columns: ['State', 'Population'],
                    rows: [
                        ['California', '39,538,223'],
                        ['Texas', '29,145,505'],
                    ],
                },
            },
        },
    ]);

    assert.match(markup, /Population/);
    assert.match(markup, /California/);
    assert.match(markup, /39,538,223/);
    assert.doesNotMatch(markup, /Widget unavailable/);
});

test('ChatTranscript renders line chart widgets inline', () => {
    const row = widgetRow('ui-line-chart');

    if (row.kind !== 'widget') {
        throw new Error('Expected widget row.');
    }

    const markup = renderTranscript([
        {
            ...row,
            widget: {
                ...row.widget,
                component: 'tavern.widget.line-chart',
                fallbackText: 'Monthly Net Signups',
                props: {
                    data: [
                        { month: 'Jan', net: -12 },
                        { month: 'Feb', net: 18 },
                    ],
                    series: [{ key: 'net', label: 'Net' }],
                    title: 'Monthly Net Signups',
                    xKey: 'month',
                },
            },
        },
    ]);

    assert.match(markup, /Monthly Net Signups/);
    assert.doesNotMatch(markup, /Widget unavailable/);
});

test('ChatTranscript renders composed chart widgets inline', () => {
    const row = widgetRow('ui-composed-chart');

    if (row.kind !== 'widget') {
        throw new Error('Expected widget row.');
    }

    const markup = renderTranscript([
        {
            ...row,
            widget: {
                ...row.widget,
                component: 'tavern.widget.composed-chart',
                fallbackText: 'Revenue and Profit',
                props: {
                    barSeries: [{ key: 'revenue', label: 'Revenue' }],
                    barUnit: 'USD',
                    data: [
                        { month: '2026-01-01', profit: 31, revenue: 120 },
                        { month: '2026-02-01', profit: 34, revenue: 138 },
                    ],
                    lineSeries: [{ key: 'profit', label: 'Profit' }],
                    lineUnit: '%',
                    title: 'Revenue and Profit',
                    xKey: 'month',
                },
            },
        },
    ]);

    assert.match(markup, /Revenue and Profit/);
    assert.doesNotMatch(markup, /Widget unavailable/);
});

test('ChatTranscript renders calendar day widgets inline', () => {
    const row = widgetRow('ui-calendar-day');

    if (row.kind !== 'widget') {
        throw new Error('Expected widget row.');
    }

    const markup = renderTranscript([
        {
            ...row,
            widget: {
                ...row.widget,
                component: 'tavern.widget.calendar-day',
                fallbackText: 'Saturday schedule',
                props: {
                    date: '2026-06-20',
                    events: [
                        {
                            endTime: '12:45',
                            startTime: '12:00',
                            title: 'Lunch',
                        },
                        {
                            endTime: '14:00',
                            startTime: '13:00',
                            title: 'Q1 roadmap review',
                        },
                    ],
                    timezone: 'America/New_York',
                    title: 'Saturday schedule',
                },
            },
        },
    ]);

    assert.match(markup, /Lunch/);
    assert.match(markup, /Q1 roadmap review/);
    assert.match(markup, /1:00 - 2:00 PM/);
    assert.match(markup, /JUN/);
    assert.match(markup, /SAT/);
    assert.match(markup, /Saturday/);
    assert.match(markup, /No description\./);
    assert.match(markup, /max-w-\[30rem\]/);
    assert.match(markup, /border-border\/45/);
    assert.match(markup, /shadow-surface-1/);
    assert.doesNotMatch(markup, /Widget unavailable/);
});

test('ChatTranscript renders html preview widgets inside a sandboxed frame shell', () => {
    const row = widgetRow('ui-html-preview');

    if (row.kind !== 'widget') {
        throw new Error('Expected widget row.');
    }

    const markup = renderTranscript([
        {
            ...row,
            widget: {
                ...row.widget,
                component: 'tavern.widget.html-preview',
                fallbackText: 'HTML preview: workbench/demos/orbit.html',
                props: {
                    height: 600,
                    path: 'workbench/demos/orbit.html',
                },
            },
        },
    ]);

    // Static render never resolves the workspace file query: the widget frame
    // and loading note must render, and no iframe may appear yet.
    assert.match(markup, /workbench\/demos\/orbit\.html/);
    assert.match(markup, /Loading preview/);
    assert.doesNotMatch(markup, /<iframe/);
    assert.doesNotMatch(markup, /Widget unavailable/);
});

test('ChatTranscript renders page widgets inside a sandboxed frame shell', () => {
    const row = widgetRow('ui-page');

    if (row.kind !== 'widget') {
        throw new Error('Expected widget row.');
    }

    const markup = renderTranscript([
        {
            ...row,
            widget: {
                ...row.widget,
                component: 'tavern.widget.page',
                fallbackText: 'Page: workbench/pages/fleet.tsx',
                props: {
                    height: 600,
                    path: 'workbench/pages/fleet.tsx',
                },
            },
        },
    ]);

    // Static render never resolves the workspace file query: the widget frame
    // and loading note must render, and no iframe may appear yet.
    assert.match(markup, /workbench\/pages\/fleet\.tsx/);
    assert.match(markup, /Loading page/);
    assert.doesNotMatch(markup, /<iframe/);
    assert.doesNotMatch(markup, /Widget unavailable/);
});

test('ChatTranscript renders calendar event description fallback', () => {
    const row = widgetRow('ui-calendar-event');

    if (row.kind !== 'widget') {
        throw new Error('Expected widget row.');
    }

    const markup = renderTranscript([
        {
            ...row,
            widget: {
                ...row.widget,
                component: 'tavern.widget.calendar-event',
                fallbackText: 'Focus block',
                props: {
                    date: '2026-06-20',
                    endTime: '14:00',
                    startTime: '13:00',
                    title: 'Focus block',
                },
            },
        },
    ]);

    assert.match(markup, /Focus block/);
    assert.match(markup, /No description\./);
    assert.match(markup, /flex items-start gap-3/);
    assert.match(markup, /min-h-\[72px\] min-w-0 flex-1 flex-col gap-1/);
    assert.doesNotMatch(markup, /Widget unavailable/);
});

test('ChatTranscript renders fallback for invalid widgets', () => {
    const row = widgetRow('ui-invalid');

    if (row.kind !== 'widget') {
        throw new Error('Expected widget row.');
    }

    const markup = renderTranscript([
        {
            ...row,
            widget: {
                ...row.widget,
                props: { data: [] },
                validationError: 'Invalid widget payload.',
            },
        },
    ]);

    assert.match(markup, /Quarterly Revenue/);
    assert.match(markup, /Widget unavailable/);
});

test('ChatTranscript renders fallback when widget props do not match the component', () => {
    const row = widgetRow('ui-mismatched-table');

    if (row.kind !== 'widget') {
        throw new Error('Expected widget row.');
    }

    const markup = renderTranscript([
        {
            ...row,
            widget: {
                ...row.widget,
                component: 'tavern.widget.table',
                fallbackText: 'Top states',
                props: {
                    data: [{ state: 'California' }],
                    series: [{ key: 'state', label: 'State' }],
                    title: 'Top states',
                    xKey: 'state',
                },
            },
        },
    ]);

    assert.match(markup, /Top states/);
    assert.match(markup, /Widget unavailable/);
    assert.doesNotMatch(markup, /California/);
});

test('ChatTranscript renders fallback for unknown widget components', () => {
    const row = widgetRow('ui-unknown');

    if (row.kind !== 'widget') {
        throw new Error('Expected widget row.');
    }

    const markup = renderTranscript([
        {
            ...row,
            widget: {
                ...row.widget,
                component: 'tavern.unknown',
            },
        },
    ]);

    assert.match(markup, /Quarterly Revenue/);
    assert.match(markup, /Widget unavailable/);
});

test('ChatTranscript keeps reasoning out of the chat pane', () => {
    const rows: ChatRow[] = [
        {
            id: 'thinking-1',
            kind: 'system',
            systemKind: 'thinking',
            thinking: {
                id: 'thinking-1',
                messageId: 'response-1',
                sender: 'tiny',
                text: 'I should greet the user directly.',
                timestamp: '2026-03-31T15:00:00.000Z',
            },
            timestamp: '2026-03-31T15:00:00.000Z',
        },
    ];

    // Reasoning belongs to the turn details drawer alongside tool work, not
    // the chat transcript.
    assert.doesNotMatch(renderTranscript(rows), /I should greet the user directly\./);
    assert.match(renderTurnBody(rows), /I should greet the user directly\./);
});

test('ChatTranscript keeps active thinking out of the pane and in the turn body', () => {
    const rows: ChatRow[] = [
        {
            id: 'thinking-1',
            kind: 'system',
            systemKind: 'thinking',
            thinking: {
                id: 'thinking-1',
                messageId: 'response-1',
                sender: 'tiny',
                text: '**Reviewing the request** I should inspect the workspace before using a command.',
                timestamp: '2026-03-31T15:00:00.000Z',
            },
            timestamp: '2026-03-31T15:00:00.000Z',
        },
        {
            id: 'thinking-2',
            kind: 'system',
            systemKind: 'thinking',
            thinking: {
                id: 'thinking-2',
                messageId: 'response-1',
                sender: 'tiny',
                text: '**Checking tool output** I should summarize only the command result.',
                timestamp: '2026-03-31T15:00:02.000Z',
            },
            timestamp: '2026-03-31T15:00:02.000Z',
        },
    ];
    const markup = renderActiveTranscript(
        {
            agentId: 'tiny',
            isThinking: true,
            runId: 'response-1',
            sessionKey: 'agent:tiny:session-1',
            startedAt: '2026-03-31T15:00:00.000Z',
            text: '',
        },
        rows
    );
    const turnBodyMarkup = renderTurnBody(rows);

    assert.doesNotMatch(markup, /Reviewing the request/);
    assert.doesNotMatch(markup, /Checking tool output/);
    assert.match(turnBodyMarkup, /Reviewing the request/);
    assert.match(turnBodyMarkup, /I should inspect the workspace before using a command\./);
    assert.match(turnBodyMarkup, /Checking tool output/);
    assert.match(turnBodyMarkup, /I should summarize only the command result\./);
});

test('SystemStep uses leading bold thinking text as the thinking step title', () => {
    const markup = renderToStaticMarkup(
        <SystemStep
            index={0}
            isLast
            row={{
                id: 'thinking-1',
                kind: 'system',
                systemKind: 'thinking',
                thinking: {
                    id: 'thinking-1',
                    messageId: 'response-1',
                    sender: 'tiny',
                    text: '**Deciding on greeting approach** It seems I can answer directly.',
                    timestamp: '2026-03-31T15:00:00.000Z',
                },
                timestamp: '2026-03-31T15:00:00.000Z',
            }}
        />
    );

    assert.match(markup, /Deciding on greeting approach/);
    assert.match(markup, /It seems I can answer directly\./);
    assert.doesNotMatch(markup, /\*\*Deciding on greeting approach\*\*/);
    assert.doesNotMatch(markup, /<svg/u);
});

test('ChatTranscript keeps thinking rows alongside tool work in the turn body', () => {
    const markup = renderTurnBody([
        {
            id: 'thinking-1',
            kind: 'system',
            systemKind: 'thinking',
            thinking: {
                id: 'thinking-1',
                messageId: 'response-1',
                sender: 'tiny',
                text: 'I should inspect the workspace.',
                timestamp: '2026-03-31T15:00:00.000Z',
            },
            timestamp: '2026-03-31T15:00:00.000Z',
        },
        {
            actor: { id: 'tiny', kind: 'agent' },
            completedAt: '2026-03-31T15:00:01.000Z',
            connectsToNext: false,
            connectsToPrevious: true,
            id: 'tool-1',
            isFirstInGroup: false,
            kind: 'tool',
            sessionKey: 'agent:tiny:session-1',
            spawnedRelationships: [],
            startedAt: '2026-03-31T15:00:00.500Z',
            toolCall: {
                callId: 'call-1',
                facts: [],
                label: 'command -v node',
                name: 'exec',
                status: 'completed',
                summaryParts: ['command -v node'],
            },
        },
    ]);

    assert.match(markup, /I should inspect the workspace\./);
    // A lone short command can surface in the group header; the row still
    // owns the inspectable command details.
    assert.match(markup, /Ran command -v node/);
    assert.match(markup, /command -v node/);
    assert.match(markup, />Used</);
    assert.doesNotMatch(markup, /Used a tool/);
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

test('ToolStep renders completed verbs in neutral text and the whole row as the drawer trigger', () => {
    const markup = renderToStaticMarkup(
        <ToolStep
            index={0}
            isLast
            row={{
                actor: { id: 'tiny', kind: 'agent' },
                completedAt: '2026-03-31T15:00:05.000Z',
                connectsToNext: false,
                connectsToPrevious: false,
                id: 'tool-neutral',
                isFirstInGroup: true,
                kind: 'tool',
                sessionKey: 'agent:tiny:session-1',
                spawnedRelationships: [],
                startedAt: '2026-03-31T15:00:00.000Z',
                toolCall: {
                    callId: null,
                    facts: [],
                    label: 'bash · date',
                    name: 'bash',
                    status: 'ok',
                    summaryParts: ['date'],
                },
            }}
        />
    );

    assert.doesNotMatch(markup, /text-success/);
    assert.match(markup, /text-muted-foreground">Used</);
    assert.match(markup, /aria-label="Inspect bash · date"[^>]*data-slot="drawer-trigger"/);
    assert.match(markup, /cursor-default/);
    assert.doesNotMatch(markup, /cursor-pointer/);
    assert.doesNotMatch(markup, /thinking-indicator-text/);
});

test('ToolStep scopes generic failures to the failed tool target', () => {
    const markup = renderToStaticMarkup(
        <ToolStep
            index={0}
            isLast
            row={{
                actor: { id: 'tiny', kind: 'agent' },
                completedAt: '2026-03-31T15:00:05.000Z',
                connectsToNext: false,
                connectsToPrevious: false,
                id: 'tool-read-failed',
                isFirstInGroup: true,
                kind: 'tool',
                sessionKey: 'agent:tiny:session-1',
                spawnedRelationships: [],
                startedAt: '2026-03-31T15:00:00.000Z',
                toolCall: {
                    callId: null,
                    facts: [
                        {
                            label: 'Error',
                            tone: 'danger',
                            value: 'HTTP 400: Unsupported content type',
                        },
                    ],
                    label: 'read · bad-upload.png',
                    name: 'read',
                    status: 'error',
                    summaryParts: ['bad-upload.png'],
                },
            }}
        />
    );

    assert.match(markup, />Failed</);
    assert.match(markup, /read bad-upload\.png/);
    assert.doesNotMatch(markup, /Unsupported content type/);
});

test('ToolStep renders terminal rows with the command instead of the tool name', () => {
    const command = 'merchbase sales series --range 10d --bucket day --marketplace US';
    const markup = renderToStaticMarkup(
        <ToolStep
            index={0}
            isLast
            row={{
                actor: { id: 'tiny', kind: 'agent' },
                completedAt: '2026-03-31T15:00:05.000Z',
                connectsToNext: false,
                connectsToPrevious: false,
                id: 'tool-terminal',
                isFirstInGroup: true,
                kind: 'tool',
                sessionKey: 'agent:tiny:session-1',
                spawnedRelationships: [],
                startedAt: '2026-03-31T15:00:00.000Z',
                toolCall: {
                    callId: null,
                    facts: [{ label: 'Command', tone: 'default', value: command }],
                    label: 'terminal',
                    name: 'terminal',
                    status: 'ok',
                    summaryParts: [command],
                },
            }}
        />
    );

    assert.match(markup, />Used</);
    assert.match(markup, /merchbase sales series --range 10d --bucket day --marketplace US/);
    assert.doesNotMatch(markup, />terminal</);
});

test('ToolStep caps long inline tool targets', () => {
    const command =
        'merchbase sales series --range 365d --bucket day --marketplace US --format json --include-orders --debug';
    const markup = renderToStaticMarkup(
        <ToolStep
            index={0}
            isLast
            row={{
                actor: { id: 'tiny', kind: 'agent' },
                completedAt: '2026-03-31T15:00:05.000Z',
                connectsToNext: false,
                connectsToPrevious: false,
                id: 'tool-terminal-long',
                isFirstInGroup: true,
                kind: 'tool',
                sessionKey: 'agent:tiny:session-1',
                spawnedRelationships: [],
                startedAt: '2026-03-31T15:00:00.000Z',
                toolCall: {
                    callId: null,
                    facts: [{ label: 'Command', tone: 'default', value: command }],
                    label: 'terminal',
                    name: 'terminal',
                    status: 'ok',
                    summaryParts: [command],
                },
            }}
        />
    );

    assert.match(
        markup,
        /merchbase sales series --range 365d --bucket day --marketplace US --format json --include-ord/
    );
    assert.match(markup, /\.\.\./);
    assert.doesNotMatch(markup, /--debug/);
});

test('ToolStep shimmers running tool rows like the thinking indicator', () => {
    const markup = renderToStaticMarkup(
        <ToolStep
            index={0}
            isLast
            row={{
                actor: { id: 'tiny', kind: 'agent' },
                completedAt: null,
                connectsToNext: false,
                connectsToPrevious: false,
                id: 'tool-running',
                isFirstInGroup: true,
                kind: 'tool',
                sessionKey: 'agent:tiny:session-1',
                spawnedRelationships: [],
                startedAt: '2026-03-31T15:00:00.000Z',
                toolCall: {
                    callId: null,
                    facts: [],
                    label: 'bash · sleep 4',
                    name: 'bash',
                    status: 'running',
                    summaryParts: ['sleep 4'],
                },
            }}
        />
    );

    assert.match(markup, /thinking-indicator-text/);
    assert.match(markup, />Using</);
});

test('ToolStep keeps older tool rows inspectable when call id is missing', () => {
    const markup = renderToStaticMarkup(
        <ToolStep
            index={0}
            isLast
            row={{
                actor: { id: 'tiny', kind: 'agent' },
                completedAt: '2026-03-31T15:00:05.000Z',
                connectsToNext: false,
                connectsToPrevious: false,
                id: 'tool-old',
                isFirstInGroup: true,
                kind: 'tool',
                sessionKey: 'agent:tiny:session-1',
                spawnedRelationships: [],
                startedAt: '2026-03-31T15:00:00.000Z',
                toolCall: {
                    callId: null,
                    facts: [],
                    label: 'computer use.list apps',
                    name: 'tool',
                    status: 'completed',
                    summaryParts: ['computer use.list apps'],
                },
            }}
        />
    );

    assert.match(markup, /data-slot="drawer-trigger"/);
    assert.match(markup, /computer use\.list apps/);
});

test('ToolDrawerBody renders a concise unavailable state when tool details cannot load', () => {
    const markup = renderToStaticMarkup(
        <ToolDrawerBody details={null} isPending={false} queryError />
    );

    assert.match(markup, /Tool details not available\./);
});

test('ToolStep avoids duplicating the tool verb when the activity title already includes it', () => {
    const markup = renderToStaticMarkup(
        <ToolStep
            index={0}
            isLast
            row={{
                actor: { id: 'tiny', kind: 'agent' },
                completedAt: '2026-03-31T15:00:05.000Z',
                connectsToNext: false,
                connectsToPrevious: false,
                id: 'tool-read',
                isFirstInGroup: true,
                kind: 'tool',
                sessionKey: 'agent:tiny:session-1',
                spawnedRelationships: [],
                startedAt: '2026-03-31T15:00:00.000Z',
                toolCall: {
                    callId: null,
                    facts: [],
                    label: 'read from QA_KICKOFF_TASK.md',
                    name: 'read',
                    status: 'completed',
                    summaryParts: ['read from QA_KICKOFF_TASK.md'],
                },
            }}
        />
    );

    assert.match(markup, />Used</);
    assert.match(markup, /read from QA_KICKOFF_TASK\.md/);
    assert.doesNotMatch(markup, /Read read from QA_KICKOFF_TASK\.md/);
});

test('ChatTranscript omits completed activity timing beside transcript rows', () => {
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

    assert.doesNotMatch(markup, /Worked for 2 minutes 3 seconds/);
    assert.doesNotMatch(markup, /Agent idle/);
});

test('ArtifactLogEntry renders durable artifact titles', () => {
    const markup = renderToStaticMarkup(
        <ArtifactLogEntry
            entry={{
                artifact: {
                    artifactType: 'document',
                    createdAt: '2026-03-31T15:00:05.000Z',
                    id: 'art-report',
                    mimeType: 'text/markdown',
                    path: 'file:///tmp/report.md',
                    payload: {
                        contentRef: 'file:///tmp/report.md',
                        contentText: '# Report',
                        title: 'Report',
                    },
                },
                id: 'art-report',
                kind: 'system',
                systemKind: 'artifact',
                timestamp: '2026-03-31T15:00:05.000Z',
            }}
        />
    );

    assert.match(markup, /document/);
    assert.match(markup, /Report/);
});

test('the turn drawer renders completed narration evidence as prose', () => {
    const narrationText =
        'Open https://accounts.google.com/o/oauth2/auth?response_type=code&client_id=preview-client.apps.googleusercontent.com&redirect_uri=http%3A%2F%2Flocalhost%3A1&scope=calendar.events.readonly before the final reply.';
    const markup = renderTurnBody([
        {
            actor: { id: 'tiny', kind: 'agent' },
            completedAt: '2026-03-31T15:00:01.000Z',
            connectsToNext: false,
            connectsToPrevious: false,
            id: 'activity:run-1:assistant-reply:1',
            isFirstInGroup: true,
            kind: 'tool',
            sessionKey: 'agent:tiny:session-1',
            spawnedRelationships: [],
            startedAt: '2026-03-31T15:00:00.000Z',
            toolCall: {
                callId: null,
                facts: [
                    {
                        label: 'Detail',
                        tone: 'default',
                        value: narrationText,
                    },
                ],
                label: 'Assistant reply',
                name: 'message',
                status: 'ok',
                summaryParts: ['Assistant reply', narrationText],
            },
        },
    ]);

    assert.match(markup, /Open https:\/\/accounts\.google\.com\/o\/oauth2\/auth/);
    assert.match(markup, /\[overflow-wrap:anywhere\]/);
    assert.doesNotMatch(markup, /Assistant reply\n/);
});

test('ChatTranscript renders durable activity once when an assistant reply follows it', () => {
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

    const markup = renderTranscript(rows);

    assert.doesNotMatch(markup, /Worked for/);
    assert.match(markup, /NYC right now: 61F\./);
});

test('ChatTranscript renders runtime notices outside the work disclosure', () => {
    const markup = renderTranscript([
        {
            id: 'runtime-notice-1',
            kind: 'system',
            runtimeNotice: {
                agentId: null,
                detail: 'Compacted the session context.',
                kind: 'status',
                sessionId: null,
                text: 'Compacted the session context.',
                title: 'Context status',
            },
            systemKind: 'runtimeNotice',
            timestamp: '2026-03-31T15:00:00.000Z',
        },
    ]);

    assert.match(markup, /Context status/);
    assert.match(markup, /data-slot="drawer-trigger"/);
    assert.doesNotMatch(markup, /Working/);
    assert.doesNotMatch(markup, /Worked/);
});

test('ChatTranscript attaches a new-session notice to the turn that opened it', () => {
    const markup = renderTranscript([
        {
            id: 'runtime-notice-1',
            kind: 'system',
            runtimeNotice: {
                agentId: 'tiny',
                detail: 'd348a369-223c-42a7-8220-67c7340810c2',
                kind: 'new_session',
                sessionId: 'd348a369-223c-42a7-8220-67c7340810c2',
                text: 'New session: d348a369-223c-42a7-8220-67c7340810c2',
                title: 'Started new session',
            },
            systemKind: 'runtimeNotice',
            timestamp: '2026-03-31T15:00:00.000Z',
        },
        {
            actor: { id: 'tiny', kind: 'agent' },
            connectsToNext: false,
            connectsToPrevious: false,
            id: 'message-session-open',
            isFirstInGroup: true,
            kind: 'message',
            message: {
                content: 'Fresh context, ready to go.',
                id: 'message-session-open',
                metadata: {},
                sender: 'Tiny',
                senderType: 'agent',
                sourceSessionId: null,
                sourceSessionKey: 'session-fresh',
                tavernAgentId: 'tiny',
                timestamp: '2026-03-31T15:00:05.000Z',
            },
        },
    ]);

    // No standalone notice row ahead of the reply — the turn's header carries
    // the session affordance instead.
    assert.doesNotMatch(markup, /Started new session/);
    assert.match(markup, /aria-label="Started a fresh session"/);
    assert.match(markup, /Fresh context, ready to go\./);
});

test('ChatTranscript renders nothing for a new-session notice with no turn to attach to', () => {
    const markup = renderTranscript([
        {
            id: 'runtime-notice-1',
            kind: 'system',
            runtimeNotice: {
                agentId: 'tiny',
                detail: null,
                kind: 'new_session',
                sessionId: 'session-fresh',
                text: 'New session.',
                title: 'Started new session',
            },
            systemKind: 'runtimeNotice',
            timestamp: '2026-03-31T15:00:00.000Z',
        },
    ]);

    assert.doesNotMatch(markup, /Started new session/);
    assert.doesNotMatch(markup, /aria-label="Started a fresh session"/);
});

test('ChatTranscript reveals the streaming post from its first chunk', () => {
    // The live-patch shape: the turn's first message step creates the post
    // row (streaming metadata), and the run's live overlay item drops the
    // same render. The post must mount with the paced reveal — enabled means
    // the first server render shows none of the text yet.
    const markup = renderTranscript(
        [
            {
                actor: { id: 'tiny', kind: 'agent' },
                connectsToNext: false,
                connectsToPrevious: false,
                id: 'msg_run-live_assistant',
                isFirstInGroup: true,
                kind: 'message',
                runId: 'run-live',
                message: {
                    actor: { id: 'tiny', kind: 'agent' },
                    content: 'First streamed chunk of the preamble.',
                    id: 'msg_run-live_assistant',
                    metadata: {
                        runtime: {
                            runId: 'run-live',
                            sessionKey: 'session-live',
                            source: 'agent-engine',
                            streaming: true,
                        },
                    },
                    sender: 'tiny',
                    senderType: 'agent',
                    sourceSessionId: null,
                    sourceSessionKey: 'session-live',
                    tavernAgentId: 'tiny',
                    timestamp: '2026-03-31T15:00:05.000Z',
                },
            },
        ],
        {
            activeReplies: [
                {
                    agentId: 'tiny',
                    isThinking: true,
                    runId: 'run-live',
                    sessionKey: 'session-live',
                    startedAt: '2026-03-31T15:00:00.000Z',
                    text: '',
                },
            ],
        }
    );

    assert.doesNotMatch(markup, /First streamed chunk of the preamble\./);
    assert.match(markup, /min-h-\[1lh\]/);
});

test('ChatTranscript hides a stopped turn that produced no visible content', () => {
    const markup = renderTranscript([stoppedTurnRow()]);

    assert.doesNotMatch(markup, /Agent response stopped\./);
});

test('ChatTranscript keeps the stopped note as a muted footnote under turn content', () => {
    const markup = renderTranscript([
        narrationMessageRow(
            'act_run-1_message_0',
            'I was about to check the docs.',
            Date.parse('2026-03-31T14:59:30.000Z')
        ),
        stoppedTurnRow('run-1'),
    ]);

    assert.match(markup, /I was about to check the docs\./);
    assert.match(markup, /Agent response stopped\./);
    // A quiet lifecycle note: the icon inherits the muted text color instead
    // of reading as an error.
    assert.doesNotMatch(markup, /text-error-foreground/);
    assert.doesNotMatch(markup, /data-slot="drawer-trigger"/);
    assert.doesNotMatch(markup, /Working/);
    assert.doesNotMatch(markup, /Worked/);
});

function stoppedTurnRow(runId = 'run-cancelled'): ChatRow {
    return {
        id: 'response-cancelled:cancelled',
        kind: 'system',
        responseId: 'response-cancelled',
        systemKind: 'turnStatus',
        timestamp: '2026-03-31T15:00:00.000Z',
        turnStatus: {
            agentId: 'tiny',
            runId,
            sessionKey: 'agent:tiny:session-1',
            status: 'stopped',
            text: 'Agent response stopped.',
        },
    };
}

test('ChatTranscript does not keep timing a stopped active turn', () => {
    const markup = renderActiveTranscript(
        {
            agentId: 'tiny',
            isThinking: true,
            runId: 'run-cancelled',
            sessionKey: 'agent:tiny:session-1',
            startedAt: '2026-03-31T15:00:00.000Z',
            text: '',
        },
        [
            {
                actor: { id: 'tiny', kind: 'agent' },
                completedAt: null,
                connectsToNext: true,
                connectsToPrevious: false,
                id: 'act_run-cancelled_tool_1',
                isFirstInGroup: true,
                kind: 'tool',
                sessionKey: 'agent:tiny:session-1',
                spawnedRelationships: [],
                startedAt: '2026-03-31T15:00:05.000Z',
                toolCall: {
                    callId: 'call-1',
                    facts: [],
                    label: 'bash',
                    name: 'bash',
                    status: 'running',
                    summaryParts: ['bash'],
                },
            },
            {
                id: 'response-cancelled:cancelled',
                kind: 'system',
                responseId: 'response-cancelled',
                systemKind: 'turnStatus',
                timestamp: '2026-03-31T15:00:10.000Z',
                turnStatus: {
                    agentId: 'tiny',
                    runId: 'run-cancelled',
                    sessionKey: 'agent:tiny:session-1',
                    status: 'stopped',
                    text: 'Agent response stopped.',
                },
            },
        ]
    );

    // Tool work is drawer-only, so a stopped turn with no pane-visible
    // content drops out entirely — including its lifecycle note and timer.
    assert.doesNotMatch(markup, /Agent response stopped\./);
    assert.doesNotMatch(markup, /Agent idle/);
    assert.doesNotMatch(markup, /Ran a command/);
    assert.doesNotMatch(markup, /Working for/);
});

test('ChatTranscript keeps completed agent status out of transcript after activity', () => {
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

    assert.doesNotMatch(markup, /Worked for 3 seconds/);
    assert.doesNotMatch(markup, /Worked for 1 second/);
    assert.doesNotMatch(markup, /Agent idle/);
});

test('ChatTranscript omits active-only status rows', () => {
    const markup = renderActiveTranscript({
        agentId: 'tiny',
        isThinking: true,
        runId: 'run-thinking',
        sessionKey: 'agent:tiny:session-1',
        startedAt: '2026-03-31T15:00:00.000Z',
        text: '',
    });

    assert.doesNotMatch(markup, /Agent is thinking/);
    assert.doesNotMatch(markup, /thinking-indicator-text/);
    assert.doesNotMatch(markup, /Worked/);
});

test('ChatTranscript keeps status sequence signals out of transcript', () => {
    const markup = renderActiveTranscript({
        agentId: 'tiny',
        isThinking: true,
        runId: 'run-thinking',
        sessionKey: 'agent:tiny:session-1',
        startedAt: '2026-03-31T15:00:00.000Z',
        statusSequence: 1,
        text: '',
    });

    assert.doesNotMatch(markup, /Agent is thinking/);
    assert.doesNotMatch(markup, /thinking-indicator-text/);
});

test('ChatTranscript omits presence-only agent turns in multi-agent layout', () => {
    const markup = renderActiveTranscript(
        {
            agentId: 'tiny',
            isThinking: true,
            runId: 'run-thinking',
            sessionKey: 'agent:tiny:session-1',
            startedAt: '2026-03-31T15:00:00.000Z',
            text: '',
        },
        [],
        { showAgentIdentity: true, showHumanIdentity: false }
    );

    assert.doesNotMatch(markup, />Agent</);
    assert.doesNotMatch(markup, /Agent is thinking/);
});

test('ChatTranscript keeps active reply identity without bottom status text', () => {
    const markup = renderActiveTranscript(
        {
            agentId: 'tiny',
            isThinking: false,
            runId: 'run-replying',
            sessionKey: 'agent:tiny:session-1',
            startedAt: '2026-03-31T15:00:00.000Z',
            text: 'Replying now.',
        },
        [],
        { showAgentIdentity: true, showHumanIdentity: false }
    );

    assert.equal(markup.match(/>Agent</g)?.length, 1);
    assert.doesNotMatch(markup, /Agent is replying/);
});

test('ChatTranscript omits empty non-thinking replies from transcript status', () => {
    const markup = renderActiveTranscript({
        agentId: 'tiny',
        isThinking: false,
        runId: 'run-typing',
        sessionKey: 'agent:tiny:session-1',
        startedAt: '2026-03-31T15:00:00.000Z',
        text: '',
    });

    assert.doesNotMatch(markup, /Agent is thinking/);
    assert.doesNotMatch(markup, /thinking-indicator-text/);
    assert.doesNotMatch(markup, /Worked/);
});

test('ChatTranscript shows active progress through the same thinking steps surface', () => {
    const now = Date.now();
    const markup = renderActiveTurnBody(
        {
            agentId: 'tiny',
            isThinking: true,
            runId: 'run-progress',
            sessionKey: 'agent:tiny:session-1',
            startedAt: new Date(now - 3000).toISOString(),
            text: '',
        },
        [
            {
                actor: { id: 'tiny', kind: 'agent' },
                completedAt: null,
                connectsToNext: true,
                connectsToPrevious: false,
                id: 'activity:run-progress:assistant-reply:1',
                isFirstInGroup: true,
                kind: 'tool',
                sessionKey: 'agent:tiny:session-1',
                spawnedRelationships: [],
                startedAt: new Date(now - 2500).toISOString(),
                toolCall: {
                    callId: null,
                    facts: [
                        {
                            label: 'Detail',
                            tone: 'default',
                            value: "I'll inspect the workspace before making changes.",
                        },
                    ],
                    label: 'Assistant reply',
                    name: 'message',
                    status: 'running',
                    summaryParts: [
                        'Assistant reply',
                        "I'll inspect the workspace before making changes.",
                    ],
                },
            },
            {
                actor: { id: 'tiny', kind: 'agent' },
                completedAt: null,
                connectsToNext: true,
                connectsToPrevious: true,
                id: 'activity:run-progress:tool:1',
                isFirstInGroup: false,
                kind: 'tool',
                sessionKey: 'agent:tiny:session-1',
                spawnedRelationships: [],
                startedAt: new Date(now - 1500).toISOString(),
                toolCall: {
                    callId: 'call-1',
                    facts: [],
                    label: 'Listing files',
                    name: 'bash',
                    status: 'running',
                    summaryParts: ['Listing files'],
                },
            },
            {
                actor: { id: 'tiny', kind: 'agent' },
                completedAt: null,
                connectsToNext: false,
                connectsToPrevious: true,
                id: 'activity:run-progress:assistant-reply:2',
                isFirstInGroup: false,
                kind: 'tool',
                sessionKey: 'agent:tiny:session-1',
                spawnedRelationships: [],
                startedAt: new Date(now - 500).toISOString(),
                toolCall: {
                    callId: null,
                    facts: [],
                    label: 'I found the files. Next I will inspect the renderer.',
                    name: 'message',
                    status: 'running',
                    summaryParts: ['I found the files. Next I will inspect the renderer.'],
                },
            },
        ]
    );

    assert.match(markup, /I&#x27;ll inspect the workspace before making changes\./);
    assert.doesNotMatch(markup, /Assistant reply\n/);
    assert.match(markup, /Using[\s\S]*Listing files/);
    assert.match(markup, /I found the files\. Next I will inspect the renderer\./);
    assert.doesNotMatch(markup, /Agent is working/);
    assert.match(markup, /chat-step-enter/);
    assert.doesNotMatch(markup, />Running</);
    assert.doesNotMatch(markup, /chat-turn-work-panel/);
});

test('ChatTranscript renders active tool progress as one-line status rows', () => {
    const markup = renderActiveTurnBody(
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
                actor: { id: 'tiny', kind: 'agent' },
                completedAt: null,
                connectsToNext: false,
                connectsToPrevious: false,
                id: 'activity:run-progress:tool:1',
                isFirstInGroup: true,
                kind: 'tool',
                sessionKey: 'agent:tiny:session-1',
                spawnedRelationships: [],
                startedAt: new Date().toISOString(),
                toolCall: {
                    callId: 'call-1',
                    facts: [
                        {
                            label: 'Detail',
                            tone: 'default',
                            value: 'start',
                        },
                    ],
                    label: 'bash',
                    name: 'bash',
                    status: 'running',
                    summaryParts: ['bash'],
                },
            },
        ]
    );

    assert.match(markup, /Using[\s\S]*bash/);
    assert.match(markup, /data-slot="drawer-trigger"/);
    assert.doesNotMatch(markup, /Agent is working/);
    assert.doesNotMatch(markup, />Running</);
    assert.doesNotMatch(markup, />start</);
});

test('ChatTranscript renders a pending clarification as a read-only question row', () => {
    const markup = renderActiveTranscript(
        {
            agentId: 'tiny',
            isThinking: true,
            runId: 'run-clarify',
            sessionKey: 'agent:tiny:session-1',
            startedAt: new Date(Date.now() - 3000).toISOString(),
            text: '',
        },
        [
            {
                actor: { id: 'tiny', kind: 'agent' },
                clarification: {
                    answer: null,
                    choices: ['Los Angeles', 'San Francisco'],
                    deadlineAt: new Date(Date.now() + 60_000).toISOString(),
                    disposition: null,
                    question: 'Which part of California?',
                    requestId: 'clarify_1',
                },
                completedAt: null,
                connectsToNext: false,
                connectsToPrevious: false,
                id: 'act_run-clarify_clarify_1',
                isFirstInGroup: true,
                kind: 'tool',
                sessionKey: 'agent:tiny:session-1',
                spawnedRelationships: [],
                startedAt: new Date().toISOString(),
                toolCall: {
                    callId: null,
                    facts: [],
                    label: 'Clarification',
                    name: 'clarify',
                    status: null,
                    summaryParts: ['Which part of California?'],
                },
            },
        ]
    );

    assert.match(markup, /Needs an answer[\s\S]*Which part of California\?/);
    assert.doesNotMatch(markup, /Los Angeles/);
    assert.doesNotMatch(markup, /San Francisco/);
    assert.doesNotMatch(markup, />Other</);
    assert.doesNotMatch(markup, />Skip</);
    assert.doesNotMatch(markup, /Using[\s\S]*Which part of California\?/);
});

test('ChatTranscript renders free-text clarifications as read-only question rows', () => {
    const markup = renderActiveTranscript(
        {
            agentId: 'tiny',
            isThinking: true,
            runId: 'run-clarify',
            sessionKey: 'agent:tiny:session-1',
            startedAt: new Date(Date.now() - 3000).toISOString(),
            text: '',
        },
        [
            {
                actor: { id: 'tiny', kind: 'agent' },
                clarification: {
                    answer: null,
                    choices: [],
                    deadlineAt: new Date(Date.now() + 60_000).toISOString(),
                    disposition: null,
                    question: 'Which city should I use?',
                    requestId: 'clarify_text',
                },
                completedAt: null,
                connectsToNext: false,
                connectsToPrevious: false,
                id: 'act_run-clarify_text',
                isFirstInGroup: true,
                kind: 'tool',
                sessionKey: 'agent:tiny:session-1',
                spawnedRelationships: [],
                startedAt: new Date().toISOString(),
                toolCall: {
                    callId: null,
                    facts: [],
                    label: 'Clarification',
                    name: 'clarify',
                    status: null,
                    summaryParts: ['Which city should I use?'],
                },
            },
        ]
    );

    assert.match(markup, /Needs an answer[\s\S]*Which city should I use\?/);
    assert.equal(countMatches(markup, />Answer</g), 0);
    assert.doesNotMatch(markup, />Other</);
});

test('ChatTranscript wires active progress tool ids to the tool drawer trigger', () => {
    const markup = renderActiveTurnBody(
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
                actor: { id: 'tiny', kind: 'agent' },
                completedAt: null,
                connectsToNext: false,
                connectsToPrevious: false,
                id: 'activity:run-progress:tool:call_123',
                isFirstInGroup: true,
                kind: 'tool',
                sessionKey: 'agent:tiny:session-1',
                spawnedRelationships: [],
                startedAt: new Date().toISOString(),
                toolCall: {
                    callId: 'call_123',
                    facts: [],
                    label: 'computer use.list apps',
                    name: 'computer-use.list_apps',
                    status: 'running',
                    summaryParts: ['computer use.list apps'],
                },
            },
        ]
    );

    assert.match(markup, /Using[\s\S]*computer use\.list apps/);
    assert.match(markup, /data-slot="drawer-trigger"/);
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
                actor: { id: 'tiny', kind: 'agent' },
                completedAt: new Date().toISOString(),
                connectsToNext: false,
                connectsToPrevious: false,
                id: 'activity:run-progress:assistant-reply:1',
                isFirstInGroup: true,
                kind: 'tool',
                sessionKey: 'agent:tiny:session-1',
                spawnedRelationships: [],
                startedAt: new Date(Date.now() - 3000).toISOString(),
                toolCall: {
                    callId: null,
                    facts: [],
                    label: 'Assistant reply',
                    name: 'message',
                    status: 'completed',
                    summaryParts: ['Assistant reply'],
                },
            },
        ]
    );

    assert.doesNotMatch(markup, /Worked for/);
});

test('ChatTranscript keeps active work headers stable between fast completed tools', () => {
    const markup = renderActiveTurnBody(
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
                actor: { id: 'tiny', kind: 'agent' },
                completedAt: new Date(Date.now() - 1200).toISOString(),
                connectsToNext: true,
                connectsToPrevious: false,
                id: 'activity:run-progress:tool:1',
                isFirstInGroup: true,
                kind: 'tool',
                sessionKey: 'agent:tiny:session-1',
                spawnedRelationships: [],
                startedAt: new Date(Date.now() - 1400).toISOString(),
                toolCall: {
                    callId: 'call-1',
                    facts: [],
                    label: 'query one',
                    name: 'search_files',
                    status: 'completed',
                    summaryParts: ['query one'],
                },
            },
            {
                actor: { id: 'tiny', kind: 'agent' },
                completedAt: new Date(Date.now() - 600).toISOString(),
                connectsToNext: false,
                connectsToPrevious: true,
                id: 'activity:run-progress:tool:2',
                isFirstInGroup: false,
                kind: 'tool',
                sessionKey: 'agent:tiny:session-1',
                spawnedRelationships: [],
                startedAt: new Date(Date.now() - 800).toISOString(),
                toolCall: {
                    callId: 'call-2',
                    facts: [],
                    label: 'query two',
                    name: 'search_files',
                    status: 'completed',
                    summaryParts: ['query two'],
                },
            },
        ]
    );

    assert.match(markup, />Searched code</);
    assert.doesNotMatch(markup, /Searched code 2 times/);
});

test('ChatTranscript renders the streaming post as one evolving contribution', () => {
    const runId = 'run_0198f00d-1111-4222-8333-444455556666_blippy';
    const postId = `msg_${runId}_assistant`;
    const post = (content: string, streaming: boolean) =>
        ({
            actor: { id: 'blippy', kind: 'agent' },
            connectsToNext: false,
            connectsToPrevious: false,
            id: postId,
            isFirstInGroup: true,
            kind: 'message',
            runId,
            message: {
                tavernAgentId: 'blippy',
                content,
                id: postId,
                metadata: { runtime: { runId, sessionKey: 'ses_1', streaming } },
                sender: 'blippy',
                senderType: 'agent',
                sourceSessionId: null,
                sourceSessionKey: 'ses_1',
                timestamp: '2026-07-07T12:00:01.000Z',
            },
        }) as ChatRow;

    // Mid-turn the post exists as one message and edits in place: exactly one
    // assistant bubble, no live overlay beside it.
    const live = renderActiveTranscript(
        {
            agentId: 'blippy',
            isThinking: true,
            runId,
            sessionKey: 'ses_1',
            startedAt: '2026-07-07T12:00:00.000Z',
            text: 'Update: halfway there.',
        },
        [post('Update: halfway there.', true)]
    );
    assert.equal(live.match(/data-from="assistant"/g)?.length ?? 0, 1);

    // The finalized post is the same single message.
    const done = renderTranscript([post('All done.', false)]);
    assert.match(done, /All done\./);
    assert.equal(done.match(/data-from="assistant"/g)?.length ?? 0, 1);
});

test('ChatTranscript keeps narration messages in the work log above later tools', () => {
    const now = Date.now();
    const markup = renderActiveTurnBody(
        {
            agentId: 'tiny',
            isThinking: true,
            runId: 'run-1',
            sessionKey: 'agent:tiny:session-1',
            startedAt: new Date(now - 3000).toISOString(),
            text: '',
        },
        [
            {
                actor: { id: 'tiny', kind: 'agent' },
                connectsToNext: false,
                connectsToPrevious: false,
                id: 'act_run-1_message_1',
                isFirstInGroup: true,
                kind: 'message',
                message: {
                    tavernAgentId: 'tiny',
                    content: 'I will inspect the workspace before replying.',
                    id: 'act_run-1_message_1',
                    metadata: { runtime: { runId: 'run-1', sessionKey: 'agent:tiny:session-1' } },
                    sender: 'tiny',
                    senderType: 'agent',
                    sourceSessionId: null,
                    sourceSessionKey: 'agent:tiny:session-1',
                    timestamp: new Date(now - 2500).toISOString(),
                },
            },
            {
                actor: { id: 'tiny', kind: 'agent' },
                completedAt: null,
                connectsToNext: false,
                connectsToPrevious: false,
                id: 'act_run-1_call_1',
                isFirstInGroup: true,
                kind: 'tool',
                sessionKey: 'agent:tiny:session-1',
                spawnedRelationships: [],
                startedAt: new Date(now - 1500).toISOString(),
                toolCall: {
                    callId: 'call_1',
                    facts: [],
                    label: 'Listing files',
                    name: 'search_files',
                    status: 'running',
                    summaryParts: ['Listing files'],
                },
            },
        ]
    );
    const narrationIndex = markup.indexOf('I will inspect the workspace before replying.');
    const toolIndex = markup.indexOf('Listing files');

    assert.doesNotMatch(markup, /Worked for/);
    assert.match(markup, /flex min-w-0 flex-col gap-3/);
    assert.doesNotMatch(markup, /-my-1\.5/);
    assert.ok(narrationIndex >= 0 && toolIndex >= 0, 'narration and tool both render');
    assert.ok(narrationIndex < toolIndex, 'narration renders above the tool that follows it');
});

test('the pane narration slot keeps only the latest update while the turn runs', () => {
    const now = Date.now();
    const segments = filterPaneSegments(
        groupAgentItems([
            {
                kind: 'row',
                row: narrationMessageRow(
                    'act_run-1_message_0',
                    'I will inspect the workspace first.',
                    now - 2000
                ),
            },
            {
                kind: 'row',
                row: narrationMessageRow(
                    'act_run-1_message_1',
                    'The layout matches the map.',
                    now - 1000
                ),
            },
        ])
    );

    assert.equal(segments.length, 1);
    assert.equal(segments[0]?.key, 'narration:run-1');

    const item = segments[0]?.kind === 'item' ? segments[0].item : null;
    assert.ok(item?.kind === 'row' && item.row.kind === 'message');
    assert.equal(item.row.message.content, 'The layout matches the map.');
});

test('the pane drops narration when the run replied in a sibling turn entry', () => {
    const now = Date.now();
    const segments = filterPaneSegments(
        groupAgentItems([
            {
                kind: 'row',
                row: narrationMessageRow(
                    'act_run-1_message_0',
                    'I will inspect the workspace first.',
                    now - 2000
                ),
            },
        ]),
        new Set(['run-1'])
    );

    assert.equal(segments.length, 0);
});

test('ChatTranscript replaces narration with the final reply once it lands', () => {
    const now = Date.now();
    const markup = renderTranscript([
        narrationMessageRow(
            'act_run-1_message_0',
            'I will inspect the workspace first.',
            now - 2000
        ),
        narrationMessageRow('act_run-1_message_1', 'The layout matches the map.', now - 1000),
        {
            actor: { id: 'tiny', kind: 'agent' },
            connectsToNext: false,
            connectsToPrevious: true,
            id: 'msg_run-1_assistant',
            isFirstInGroup: false,
            kind: 'message',
            message: {
                tavernAgentId: 'tiny',
                content: 'The workspace looks well organized.',
                id: 'msg_run-1_assistant',
                metadata: { runtime: { runId: 'run-1', sessionKey: 'agent:tiny:session-1' } },
                sender: 'tiny',
                senderType: 'agent',
                sourceSessionId: null,
                sourceSessionKey: 'agent:tiny:session-1',
                timestamp: new Date(now - 500).toISOString(),
            },
        },
    ]);

    assert.match(markup, /The workspace looks well organized\./);
    assert.doesNotMatch(markup, /I will inspect the workspace first\./);
    assert.doesNotMatch(markup, /The layout matches the map\./);
});

function narrationMessageRow(id: string, content: string, timestampMs: number): ChatRow {
    return {
        actor: { id: 'tiny', kind: 'agent' },
        connectsToNext: false,
        connectsToPrevious: false,
        id,
        isFirstInGroup: true,
        kind: 'message',
        message: {
            tavernAgentId: 'tiny',
            content,
            id,
            metadata: {
                runtime: {
                    messagePhase: 'commentary',
                    runId: 'run-1',
                    sessionKey: 'agent:tiny:session-1',
                },
            },
            sender: 'tiny',
            senderType: 'agent',
            sourceSessionId: null,
            sourceSessionKey: 'agent:tiny:session-1',
            timestamp: new Date(timestampMs).toISOString(),
        },
    };
}

test('ChatTranscript keeps live reasoning out of the transcript pane', () => {
    const now = Date.now();
    const markup = renderActiveTranscript(
        {
            agentId: 'tiny',
            isThinking: true,
            runId: 'run-1',
            sessionKey: 'agent:tiny:session-1',
            startedAt: new Date(now - 2000).toISOString(),
            text: '',
        },
        [
            {
                id: 'act_run-1_thinking_1',
                kind: 'system',
                systemKind: 'thinking',
                thinking: {
                    id: 'act_run-1_thinking_1',
                    messageId: 'run-1',
                    sender: 'tiny',
                    text: 'Considering which files matter.',
                    timestamp: new Date(now - 1000).toISOString(),
                },
                timestamp: new Date(now - 1000).toISOString(),
            },
        ]
    );

    assert.doesNotMatch(markup, /Considering which files matter\./);
    assert.doesNotMatch(markup, /data-slot="drawer-trigger"/);
});

type ChatRow = NonNullable<ChatLogOutput>['rows'][number];

function renderTranscript(
    rows: ChatRow[],
    options: {
        activeReplies?: ChatActiveReply[];
        chatId?: string;
        defaultOpenWorkGroups?: boolean;
    } = {}
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
                    <DevModeProvider>
                        <AgentDrawerProvider>
                            <ChatTranscript
                                activeReplies={options.activeReplies ?? []}
                                chatId={options.chatId}
                                defaultOpenWorkGroups={options.defaultOpenWorkGroups}
                                rows={rows}
                            />
                        </AgentDrawerProvider>
                    </DevModeProvider>
                </MemoryRouter>
            </QueryClientProvider>
        </trpc.Provider>
    );
}

// Renders the turn-drawer body for the last agent turn — the surface tool
// work moved to now that the chat pane is prose-only.
function renderTurnBody(rows: ChatRow[], activeReply: ChatActiveReply | null = null) {
    // The drawer merges turn-scoped evidence with the entry's conversation
    // items; tests feed that merged view directly.
    const items: TranscriptItem[] = rows.map((row) => ({ kind: 'row' as const, row }));

    if (activeReply) {
        items.push({ kind: 'activeReply', reply: activeReply });
    }

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
                    <DevModeProvider>
                        <AgentDrawerProvider>
                            <ChatTurnItems
                                chatId="cht_test"
                                items={items}
                                turnActive={Boolean(activeReply)}
                            />
                        </AgentDrawerProvider>
                    </DevModeProvider>
                </MemoryRouter>
            </QueryClientProvider>
        </trpc.Provider>
    );
}

function renderActiveTurnBody(activeReply: ChatActiveReply, rows: ChatRow[] = []) {
    return renderTurnBody(rows, activeReply);
}

function renderActiveTranscript(
    activeReply: ChatActiveReply,
    rows: ChatRow[] = [],
    conversationLayout?: { showAgentIdentity: boolean; showHumanIdentity: boolean }
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
                    <DevModeProvider>
                        <AgentDrawerProvider>
                            <ChatTranscript
                                activeReplies={[activeReply]}
                                chatId="cht_test"
                                conversationLayout={conversationLayout}
                                rows={rows}
                            />
                        </AgentDrawerProvider>
                    </DevModeProvider>
                </MemoryRouter>
            </QueryClientProvider>
        </trpc.Provider>
    );
}

function widgetRow(id: string): ChatRow {
    return {
        actor: { id: 'tiny', kind: 'agent' },
        completedAt: '2026-03-31T15:00:01.000Z',
        connectsToNext: false,
        connectsToPrevious: false,
        id,
        isFirstInGroup: true,
        kind: 'widget',
        widget: {
            component: 'tavern.widget.bar-chart',
            fallbackText: 'Quarterly Revenue',
            id,
            props: {
                data: [
                    { quarter: 'Q1', revenue: 12_000 },
                    { quarter: 'Q2', revenue: 15_500 },
                ],
                series: [{ key: 'revenue', label: 'Revenue' }],
                title: 'Quarterly Revenue',
                unit: 'USD',
                xKey: 'quarter',
            },
            target: 'chat.inline',
            validationError: null,
        },
        responseId: 'rsp_ui',
        sessionKey: 'agent:tiny:session-1',
        startedAt: '2026-03-31T15:00:00.000Z',
    };
}

function countMatches(value: string, pattern: RegExp) {
    return [...value.matchAll(pattern)].length;
}
