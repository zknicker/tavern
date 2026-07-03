import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ChatActiveReply } from '../../hooks/chats/chat-timeline-state.ts';
import type { AgentListOutput } from '../../lib/trpc.tsx';
import { ChatActiveStatusStack } from './chat-active-status-stack.tsx';
import { ChatDetailFooter } from './chat-detail-footer.tsx';
import type { TranscriptRow } from './chat-transcript-model.ts';

const activeReply = {
    agentId: 'agent-1',
    isThinking: true,
    runId: 'run-1',
    sessionKey: 'agent:agent-1:session-1',
    startedAt: '2026-07-01T17:00:00.000Z',
    text: '',
} satisfies ChatActiveReply;

const agents = [
    {
        effectivePrimaryColor: '#166534',
        id: 'agent-1',
        name: 'Blippy',
    },
] as AgentListOutput['agents'];

test('ChatActiveStatusStack renders active agent status above the composer', () => {
    const markup = renderToStaticMarkup(
        <ChatActiveStatusStack activeReply={activeReply} agents={agents} rows={[]} />
    );

    assert.match(markup, /aria-label="Active agent status"/);
    assert.match(markup, /Blippy is thinking\.\.\./);
    assert.match(markup, /thinking-indicator-text/);
});

test('ChatActiveStatusStack follows current work state from active progress rows', () => {
    const markup = renderToStaticMarkup(
        <ChatActiveStatusStack
            activeReply={activeReply}
            agents={agents}
            rows={[
                {
                    actor: { id: 'agent-1', kind: 'agent' },
                    completedAt: null,
                    connectsToNext: false,
                    connectsToPrevious: false,
                    id: 'act_run-1_tool_1',
                    isFirstInGroup: true,
                    kind: 'tool',
                    sessionKey: 'agent:agent-1:session-1',
                    spawnedRelationships: [],
                    startedAt: '2026-07-01T17:00:01.000Z',
                    toolCall: {
                        callId: 'call-1',
                        facts: [],
                        label: 'Listing files',
                        name: 'bash',
                        status: 'running',
                        summaryParts: ['Listing files'],
                    },
                } satisfies TranscriptRow,
            ]}
        />
    );

    assert.match(markup, /Blippy is working\.\.\./);
    assert.match(markup, /aria-label="Agent is working"/);
});

test('ChatActiveStatusStack streams a cumulative work summary and offers turn details', () => {
    const toolRow = (id: string, name: string, summary: string) =>
        ({
            actor: { id: 'agent-1', kind: 'agent' },
            completedAt: '2026-07-01T17:00:02.000Z',
            connectsToNext: false,
            connectsToPrevious: false,
            id,
            isFirstInGroup: true,
            kind: 'tool',
            sessionKey: 'agent:agent-1:session-1',
            spawnedRelationships: [],
            startedAt: '2026-07-01T17:00:01.000Z',
            toolCall: {
                callId: id,
                facts: [],
                label: summary,
                name,
                status: 'ok',
                summaryParts: [summary],
            },
        }) satisfies TranscriptRow;
    const markup = renderToStaticMarkup(
        <ChatActiveStatusStack
            activeReply={activeReply}
            agents={agents}
            chatId="cht_test"
            rows={[
                toolRow('act_run-1_tool_1', 'exec', 'ls -la'),
                toolRow('act_run-1_tool_2', 'exec', 'bun run lint'),
                toolRow('act_run-1_tool_3', 'read_file', 'docs/README.md'),
            ]}
        />
    );

    assert.match(markup, /title="View turn details"/);
    // Cumulative intent summary rides next to the thinking label, led by the
    // work-group icon.
    assert.match(markup, /Listed files, read a file/);
    assert.match(markup, /size-3\.5 shrink-0/);
});

test('ChatActiveStatusStack does not render without an active reply', () => {
    const markup = renderToStaticMarkup(
        <ChatActiveStatusStack activeReply={null} agents={agents} rows={[]} />
    );

    assert.equal(markup, '');
});

test('ChatDetailFooter renders active status before the detail composer', () => {
    const markup = renderToStaticMarkup(
        <ChatDetailFooter activeReply={activeReply} agents={agents} rows={[]}>
            <div data-slot="composer">Composer</div>
        </ChatDetailFooter>
    );

    assert.ok(markup.indexOf('Blippy is thinking...') < markup.indexOf('Composer'));
    assert.match(markup, /lg:px-16/);
    assert.match(markup, /max-w-\[60rem\]/);
});
