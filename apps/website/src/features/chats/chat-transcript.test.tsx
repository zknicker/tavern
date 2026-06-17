import assert from 'node:assert/strict';
import test from 'node:test';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpLink } from '@trpc/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import type { ChatActiveReply } from '../../hooks/chats/chat-timeline-state.ts';
import { type ChatLogOutput, trpc } from '../../lib/trpc.tsx';
import { ArtifactLogEntry } from '../sessions/log/event-entry/artifact-entry.tsx';
import { ToolDrawerBody } from '../sessions/tools/tool-drawer-body.tsx';
import {
    ChatApprovalPrompt,
    getPendingChatApprovalPrompt,
    getVisibleChatApprovalPrompt,
} from './chat-approval-prompt.tsx';
import { ChatTranscript } from './chat-transcript.tsx';
import { SystemStep } from './chat-transcript-system-step.tsx';
import { getActiveReplyDisplayText } from './chat-transcript-turn.tsx';
import { ToolStep } from './tool-steps/registry.tsx';

const activePresenceLabelPattern = /[A-Z][A-Za-z'-]+(?: [A-Za-z'-]+)* for \d+s/;
const activePresenceShimmerPattern =
    /(?:thinking-indicator-text[^>]*aria-label|aria-label="[A-Z][^"]+ for \d+s"[^>]*thinking-indicator-text)/;

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
    assert.match(markup, /group-hover:pointer-events-auto group-hover:opacity-100/);
    assert.doesNotMatch(markup, /group-focus-within:opacity-100/);
    assert.doesNotMatch(markup, /opacity:0;transform/);
    assert.match(markup, /aria-label="Copy message"/);
    assert.doesNotMatch(markup, /aria-label="View session"/);
    assert.ok(
        markup.indexOf('aria-label="Copy message"') < markup.indexOf('Agent idle'),
        'agent presence renders below message hover actions'
    );
    assert.doesNotMatch(markup, /aria-label="Collapse message"/);
    assert.doesNotMatch(markup, /session 9f83ac/);
});

test('ChatTranscript renders constrained inline markdown in message text', () => {
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
                    '# Test\nI use **gpt-5.4-mini**, *carefully*, with `OPENAI_API_KEY`, [OpenAI](https://openai.com), www.example.com, <u>raw</u>, and [bad](javascript:alert(1)).',
                id: 'message-markdown',
                sender: 'Tiny',
                senderType: 'agent',
                sourceSessionId: null,
                sourceSessionKey: '',
                timestamp: '2026-03-31T15:00:00.000Z',
            },
        },
    ]);

    assert.match(markup, /# Test/);
    assert.match(markup, /<strong class="font-semibold">gpt-5\.4-mini<\/strong>/);
    assert.match(markup, /<em class="italic">carefully<\/em>/);
    assert.match(markup, /<code class="[^"]*">OPENAI_API_KEY<\/code>/);
    assert.match(markup, /href="https:\/\/openai\.com\/"/);
    assert.match(markup, /href="https:\/\/www\.example\.com\/"/);
    assert.match(markup, /&lt;u&gt;raw&lt;\/u&gt;/);
    assert.doesNotMatch(markup, /<h1/);
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

    assert.match(markup, /group relative flex/);
    assert.match(markup, /transform-origin:bottom left/);
    assert.doesNotMatch(markup, /pb-6/);
    assert.doesNotMatch(markup, /opacity:0;transform/);
});

test('active reply display text ignores invisible streaming edge whitespace', () => {
    assert.equal(getActiveReplyDisplayText('\n\nDone.\n\n'), 'Done.');
});

test('ChatTranscript renders tool calls and agent responses through one surface', () => {
    const markup = renderTranscript([
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
    ]);

    assert.match(markup, /Done\./);
    assert.doesNotMatch(markup, /Worked/);
    assert.match(markup, /Agent idle/);
    // Completed work starts collapsed; users expand it on demand.
    assert.match(markup, /aria-expanded="false"/);
    assert.doesNotMatch(markup, /aria-expanded="true"/);
});

test('ChatTranscript hides reasoning by default', () => {
    const markup = renderTranscript([
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
    ]);

    assert.doesNotMatch(markup, /Thinking/);
    assert.doesNotMatch(markup, /I should greet the user directly\./);
    assert.doesNotMatch(markup, /Details/);
    assert.doesNotMatch(markup, /Inspect/);
});

test('ChatTranscript renders active thinking text inline when enabled', () => {
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
        rows,
        undefined,
        { showThinkingText: true }
    );
    const completedMarkup = renderTranscript(rows);

    assert.match(markup, /Reviewing the request/);
    assert.match(markup, /I should inspect the workspace before using a command\./);
    assert.match(markup, /Checking tool output/);
    assert.match(markup, /I should summarize only the command result\./);
    assert.doesNotMatch(completedMarkup, /Checking tool output/);
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

test('ChatTranscript keeps hidden thinking out of tool work headers', () => {
    const markup = renderTranscript([
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

    assert.doesNotMatch(markup, /Thinking/);
    // A lone tool renders inside the group drawer with a count summary
    // header, so a second tool only retexts the header instead of
    // restructuring the rows.
    assert.match(markup, /Ran a command/);
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

test('ToolStep renders approval rows as ordinary tool rows', () => {
    const markup = renderToStaticMarkup(
        <ToolStep index={0} isLast row={pendingApprovalRow('approval-1', 'rm -rf build')} />
    );

    assert.match(markup, />Using</);
    assert.match(markup, /rm -rf build/);
    assert.doesNotMatch(markup, />Approve</);
    assert.doesNotMatch(markup, />Deny</);
    assert.doesNotMatch(markup, /Needs approval/);
});

test('ChatTranscript keeps approval actions out of the work log', () => {
    const rows = [
        pendingApprovalRow('approval-1', 'rm -rf build'),
        pendingApprovalRow('approval-2', 'deploy production'),
    ];
    const markup = renderTranscript(rows, { chatId: 'cht_1' });
    const prompt = getPendingChatApprovalPrompt(rows);

    assert.equal(countMatches(markup, />Allow once</g), 0);
    assert.equal(countMatches(markup, />Deny</g), 0);
    assert.match(markup, /rm -rf build/);
    assert.match(markup, /deploy production/);
    assert.doesNotMatch(markup, /Needs approval/);
    assert.deepEqual(prompt, {
        command: 'rm -rf build',
        description: null,
        id: 'approval-1',
        sessionKey: 'agent:tiny:session-1',
    });
});

test('ChatApprovalPrompt renders the oldest pending approval choices', () => {
    const prompt = getPendingChatApprovalPrompt([
        pendingApprovalRow('approval-1', 'rm -rf build', {
            description: 'delete in root path',
            summary: 'delete in root path',
        }),
        pendingApprovalRow('approval-2', 'deploy production'),
    ]);
    const markup = renderApprovalPrompt(prompt);

    assert.match(markup, /Do you want to approve this command\?/);
    assert.doesNotMatch(markup, /Question 1 of 1/);
    assert.match(markup, /rm -rf build/);
    assert.match(markup, /Reason: delete in root path/);
    assert.doesNotMatch(markup, /deploy production/);
    assert.match(markup, />Allow once</);
    assert.match(markup, />Allow session</);
    assert.match(markup, />Always allow</);
    assert.match(markup, />Deny</);
});

test('getVisibleChatApprovalPrompt hides a locally answered pending approval', () => {
    const first = pendingApprovalRow('approval-1', 'rm -rf build');
    const second = pendingApprovalRow('approval-2', 'deploy production');
    const answeredApprovalIds = new Set(['approval-1']);

    assert.equal(
        getVisibleChatApprovalPrompt({
            answeredApprovalIds,
            rows: [first, second],
        }),
        null
    );

    assert.deepEqual(
        getVisibleChatApprovalPrompt({
            answeredApprovalIds,
            rows: [
                {
                    ...first,
                    completedAt: '2026-03-31T15:00:02.000Z',
                    toolCall: { ...first.toolCall, status: 'completed' },
                },
                second,
            ],
        }),
        {
            command: 'deploy production',
            description: null,
            id: 'approval-2',
            sessionKey: 'agent:tiny:session-1',
        }
    );
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

test('ChatTranscript omits completed activity timing beside presence', () => {
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
    assert.match(markup, /Agent idle/);
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

test('ChatTranscript renders completed assistant narration as prose', () => {
    const markup = renderTranscript([
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
                        value: 'I will run the slow QA command before the final reply.',
                    },
                ],
                label: 'Assistant reply',
                name: 'message',
                status: 'ok',
                summaryParts: [
                    'Assistant reply',
                    'I will run the slow QA command before the final reply.',
                ],
            },
        },
    ]);

    assert.match(markup, /I will run the slow QA command before the final reply\./);
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
                detail: 'd348a369-223c-42a7-8220-67c7340810c2',
                kind: 'new_session',
                sessionId: 'd348a369-223c-42a7-8220-67c7340810c2',
                text: 'New session: d348a369-223c-42a7-8220-67c7340810c2',
                title: 'Started new session',
            },
            systemKind: 'runtimeNotice',
            timestamp: '2026-03-31T15:00:00.000Z',
        },
    ]);

    assert.match(markup, /Started new session/);
    assert.doesNotMatch(markup, /d348a369-223c-42a7-8220-67c7340810c2/);
    assert.match(markup, /data-slot="drawer-trigger"/);
    assert.doesNotMatch(markup, /Working/);
    assert.doesNotMatch(markup, /Worked/);
});

test('ChatTranscript renders stopped turns as a muted system row', () => {
    const markup = renderTranscript([
        {
            id: 'response-cancelled:cancelled',
            kind: 'system',
            responseId: 'response-cancelled',
            systemKind: 'turnStatus',
            timestamp: '2026-03-31T15:00:00.000Z',
            turnStatus: {
                agentId: 'tiny',
                runId: 'run-cancelled',
                sessionKey: 'agent:tiny:session-1',
                status: 'stopped',
                text: 'Agent response stopped.',
            },
        },
    ]);

    assert.match(markup, /Agent response stopped\./);
    assert.match(markup, /rounded-full bg-error/);
    assert.doesNotMatch(markup, /data-slot="drawer-trigger"/);
    assert.doesNotMatch(markup, /Working/);
    assert.doesNotMatch(markup, /Worked/);
});

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

    assert.match(markup, /Agent response stopped\./);
    assert.match(markup, /Agent idle/);
    assert.match(markup, /Ran a command/);
    assert.doesNotMatch(markup, activePresenceLabelPattern);
    assert.doesNotMatch(markup, activePresenceShimmerPattern);
    assert.doesNotMatch(markup, /Working for/);
});

test('ChatTranscript keeps completed presence eyes text-free after activity', () => {
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
    assert.match(markup, /Agent idle/);
});

test('ChatTranscript shows active presence timing when no progress exists yet', () => {
    const markup = renderActiveTranscript({
        agentId: 'tiny',
        isThinking: true,
        runId: 'run-thinking',
        sessionKey: 'agent:tiny:session-1',
        startedAt: '2026-03-31T15:00:00.000Z',
        text: '',
    });

    assert.match(markup, /Agent is thinking/);
    assert.match(markup, activePresenceLabelPattern);
    assert.match(markup, activePresenceShimmerPattern);
    assert.match(markup, /style="opacity:0/);
    assert.doesNotMatch(markup, /Worked/);
});

test('ChatTranscript rotates themed presence verbs from thinking status signals', () => {
    const markup = renderActiveTranscript({
        agentId: 'tiny',
        isThinking: true,
        runId: 'run-thinking',
        sessionKey: 'agent:tiny:session-1',
        startedAt: '2026-03-31T15:00:00.000Z',
        statusSequence: 1,
        text: '',
    });

    assert.match(markup, activePresenceLabelPattern);
    assert.doesNotMatch(markup, /Deliberating/);
    assert.doesNotMatch(markup, /Synthesizing/);
});

test('ChatTranscript identifies presence-only agent turns in multi-agent layout', () => {
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

    assert.match(markup, />Agent</);
    assert.match(markup, activePresenceLabelPattern);
});

test('ChatTranscript avoids duplicate agent identity beside visible presence rows', () => {
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
    assert.equal(markup.match(/grid-cols-\[2rem_minmax\(0,1fr\)\]/g)?.length, 2);
    assert.match(markup, /Agent is replying/);
});

test('ChatTranscript keeps empty non-thinking replies in the presence slot only', () => {
    const markup = renderActiveTranscript({
        agentId: 'tiny',
        isThinking: false,
        runId: 'run-typing',
        sessionKey: 'agent:tiny:session-1',
        startedAt: '2026-03-31T15:00:00.000Z',
        text: '',
    });

    assert.match(markup, /Agent is thinking/);
    assert.match(markup, activePresenceLabelPattern);
    assert.doesNotMatch(markup, /Worked/);
});

test('ChatTranscript shows active progress through the same thinking steps surface', () => {
    const now = Date.now();
    const markup = renderActiveTranscript(
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

    assert.match(markup, activePresenceLabelPattern);
    assert.match(markup, /I&#x27;ll inspect the workspace before making changes\./);
    assert.doesNotMatch(markup, /Assistant reply\n/);
    assert.match(markup, /Using[\s\S]*Listing files/);
    assert.match(markup, /I found the files\. Next I will inspect the renderer\./);
    assert.match(markup, /Agent is working/);
    assert.match(markup, /chat-step-enter/);
    assert.doesNotMatch(markup, />Running</);
    assert.doesNotMatch(markup, /chat-turn-work-panel/);
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
    assert.match(markup, /Agent is working/);
    assert.doesNotMatch(markup, />Running</);
    assert.doesNotMatch(markup, />start</);
});

test('ChatTranscript renders a pending clarification prompt inline', () => {
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

    assert.match(markup, /Needs answer[\s\S]*Which part of California\?/);
    assert.match(markup, /Los Angeles/);
    assert.match(markup, /San Francisco/);
    assert.match(markup, />Other</);
    assert.match(markup, />Skip</);
    assert.doesNotMatch(markup, /Using[\s\S]*Which part of California\?/);
});

test('ChatTranscript renders one answer input for free-text clarification prompts', () => {
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

    assert.match(markup, /Needs answer[\s\S]*Which city should I use\?/);
    assert.equal(countMatches(markup, />Answer</g), 1);
    assert.doesNotMatch(markup, />Other</);
});

test('ChatTranscript wires active progress tool ids to the tool drawer trigger', () => {
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

    assert.match(markup, activePresenceLabelPattern);
    assert.doesNotMatch(markup, /Worked for/);
});

test('ChatTranscript keeps active work headers stable between fast completed tools', () => {
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

    assert.match(markup, />Working</);
    assert.doesNotMatch(markup, /Searched code 2 times/);
});

test('ChatTranscript keeps narration messages in the work log above later tools', () => {
    const now = Date.now();
    const markup = renderActiveTranscript(
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

    assert.match(markup, activePresenceLabelPattern);
    assert.doesNotMatch(markup, /Worked for/);
    assert.match(markup, /flex min-w-0 flex-col gap-3/);
    assert.doesNotMatch(markup, /-my-1\.5/);
    assert.ok(narrationIndex >= 0 && toolIndex >= 0, 'narration and tool both render');
    assert.ok(narrationIndex < toolIndex, 'narration renders above the tool that follows it');
});

test('ChatTranscript keeps hidden reasoning out of live presence by default', () => {
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

    assert.match(markup, /Agent is thinking/);
    assert.doesNotMatch(markup, /Considering which files matter\./);
    assert.doesNotMatch(markup, /Details/);
    assert.doesNotMatch(markup, /data-slot="drawer-trigger"/);
});

type ChatRow = NonNullable<ChatLogOutput>['rows'][number];
type ToolChatRow = Extract<ChatRow, { kind: 'tool' }>;

function renderTranscript(
    rows: ChatRow[],
    options: {
        chatId?: string;
        defaultOpenWorkGroups?: boolean;
        showThinkingText?: boolean;
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
                    <ChatTranscript
                        activeReply={null}
                        chatId={options.chatId}
                        defaultOpenWorkGroups={options.defaultOpenWorkGroups}
                        rows={rows}
                        showThinkingText={options.showThinkingText}
                    />
                </MemoryRouter>
            </QueryClientProvider>
        </trpc.Provider>
    );
}

function renderActiveTranscript(
    activeReply: ChatActiveReply,
    rows: ChatRow[] = [],
    conversationLayout?: { showAgentIdentity: boolean; showHumanIdentity: boolean },
    options: { showThinkingText?: boolean } = {}
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
                    <ChatTranscript
                        activeReply={activeReply}
                        chatId="cht_test"
                        conversationLayout={conversationLayout}
                        rows={rows}
                        showThinkingText={options.showThinkingText}
                    />
                </MemoryRouter>
            </QueryClientProvider>
        </trpc.Provider>
    );
}

function renderApprovalPrompt(
    prompt: ReturnType<typeof getPendingChatApprovalPrompt>,
    chatId = 'cht_1'
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
                <ChatApprovalPrompt chatId={chatId} prompt={prompt} />
            </QueryClientProvider>
        </trpc.Provider>
    );
}

function pendingApprovalRow(
    id: string,
    command: string,
    options: { description?: string | null; summary?: string } = {}
): ToolChatRow {
    return {
        approval: {
            command,
            description: options.description ?? null,
            patternKey: null,
            patternKeys: [],
        },
        actor: { id: 'tiny', kind: 'agent' },
        completedAt: null,
        connectsToNext: false,
        connectsToPrevious: false,
        id,
        isFirstInGroup: true,
        kind: 'tool',
        sessionKey: 'agent:tiny:session-1',
        spawnedRelationships: [],
        startedAt: '2026-03-31T15:00:00.000Z',
        toolCall: {
            callId: null,
            facts: [],
            label: command,
            name: 'approval',
            status: 'running',
            summaryParts: [options.summary ?? command],
        },
    };
}

function countMatches(value: string, pattern: RegExp) {
    return [...value.matchAll(pattern)].length;
}
