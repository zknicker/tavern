import { expect, test } from 'bun:test';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ChatLogOutput } from '../../lib/trpc.tsx';
import type { TranscriptEntry } from './chat-transcript-model.ts';
import type { TranscriptRenderRow } from './chat-transcript-row-model.ts';
import {
    buildChatTurnTimelineMarkers,
    ChatTurnTimelineRail,
    getTimelineDashWidth,
} from './chat-turn-timeline.tsx';

type ChatRow = NonNullable<ChatLogOutput>['rows'][number];
type ChatMessageRow = Extract<ChatRow, { kind: 'message' }>;

test('chat turn timeline pairs adjacent user and agent turns by session', () => {
    const rows = [
        messageTurnRow({
            content: 'How are we surfacing available models?',
            id: 'user-1',
            participant: 'user',
            senderType: 'user',
            sessionKey: 'session-1',
        }),
        messageTurnRow({
            content: 'Model availability comes from Runtime capabilities.',
            id: 'agent-1',
            participant: 'agent',
            responseId: 'response-1',
            senderType: 'agent',
            sessionKey: 'session-1',
        }),
    ];

    expect(buildChatTurnTimelineMarkers(rows)).toEqual([
        {
            agentText: 'Model availability comes from Runtime capabilities.',
            agentRowIndex: 1,
            id: 'user-1:response-1',
            messageId: 'user-1',
            rowIndex: 0,
            status: 'completed',
            timestamp: '2026-06-26T15:00:00.000Z',
            userText: 'How are we surfacing available models?',
        },
    ]);
});

test('chat turn timeline skips agent turns from another session', () => {
    const rows = [
        messageTurnRow({
            content: 'Run this here.',
            id: 'user-1',
            participant: 'user',
            senderType: 'user',
            sessionKey: 'session-1',
        }),
        messageTurnRow({
            content: 'Different session.',
            id: 'agent-1',
            participant: 'agent',
            senderType: 'agent',
            sessionKey: 'session-2',
        }),
    ];

    expect(buildChatTurnTimelineMarkers(rows)).toEqual([]);
});

test('chat turn timeline scopes marker ids to the user turn', () => {
    const rows = [
        messageTurnRow({
            content: 'First merged demo request.',
            id: 'user-1',
            participant: 'user',
            senderType: 'user',
            sessionKey: 'session-1',
        }),
        messageTurnRow({
            content: 'First response.',
            id: 'agent-1',
            participant: 'agent',
            responseId: 'response-shared',
            senderType: 'agent',
            sessionKey: 'session-1',
        }),
        messageTurnRow({
            content: 'Second merged demo request.',
            id: 'user-2',
            participant: 'user',
            senderType: 'user',
            sessionKey: 'session-2',
        }),
        messageTurnRow({
            content: 'Second response.',
            id: 'agent-2',
            participant: 'agent',
            responseId: 'response-shared',
            senderType: 'agent',
            sessionKey: 'session-2',
        }),
    ];

    expect(buildChatTurnTimelineMarkers(rows).map((marker) => marker.id)).toEqual([
        'user-1:response-shared',
        'user-2:response-shared',
    ]);
});

test('chat turn timeline previews active agent turns', () => {
    const rows = [
        messageTurnRow({
            content: 'Check the release.',
            id: 'user-1',
            participant: 'user',
            senderType: 'user',
            sessionKey: 'session-1',
        }),
        activeAgentTurnRow('agent-active', 'session-1'),
    ];

    expect(buildChatTurnTimelineMarkers(rows)).toEqual([
        {
            agentText: 'Thinking...',
            agentRowIndex: 1,
            id: 'user-1:agent-active',
            messageId: 'user-1',
            rowIndex: 0,
            status: 'active',
            timestamp: '2026-06-26T15:00:00.000Z',
            userText: 'Check the release.',
        },
    ]);
});

test('chat turn timeline renders a single loaded turn', () => {
    const markup = renderToStaticMarkup(
        React.createElement(ChatTurnTimelineRail, {
            activeMarkerIds: new Set(['turn-1']),
            markers: [
                {
                    agentText: 'Done.',
                    agentRowIndex: 1,
                    id: 'turn-1',
                    messageId: 'user-1',
                    rowIndex: 0,
                    status: 'completed',
                    timestamp: '2026-06-26T15:00:00.000Z',
                    userText: 'Do the thing.',
                },
            ],
            onSelect: () => {},
        })
    );

    expect(markup).toContain('Chat turn timeline');
    expect(markup).toContain('Preview turn 1: Do the thing.');
    expect(markup).toContain('data-slot="chat-turn-timeline"');
    expect(markup).toContain('absolute');
    expect(markup).toContain('top-1/2');
    expect(markup).toContain('-translate-y-1/2');
    expect(markup).toContain('-left-2');
    expect(markup).toContain('gap-0.5');
    expect(markup).toContain('h-2.5');
    expect(markup).toContain('rounded-full');
    expect(markup).toContain('aria-current="location"');
    expect(markup).toContain('bg-muted-foreground/75');
});

test('timeline dash widths taper around the hovered marker', () => {
    expect([0, 1, 2, 3, 4].map((index) => getTimelineDashWidth(index, 2))).toEqual([
        20, 30, 44, 30, 20,
    ]);
    expect(getTimelineDashWidth(2, null)).toBe(12);
});

function messageTurnRow(input: {
    content: string;
    id: string;
    participant: 'agent' | 'user';
    responseId?: string;
    senderType: 'agent' | 'user';
    sessionKey: string;
}): TranscriptRenderRow {
    const actor =
        input.senderType === 'agent'
            ? ({ id: 'agent-1', kind: 'agent' } as const)
            : ({ id: 'user-1', kind: 'participant' } as const);
    const row = {
        actor,
        connectsToNext: false,
        connectsToPrevious: false,
        id: input.id,
        isFirstInGroup: true,
        kind: 'message',
        message: {
            content: input.content,
            id: input.id,
            metadata: undefined,
            sender: input.senderType === 'agent' ? 'Agent' : 'You',
            senderType: input.senderType,
            sourceSessionId: null,
            sourceSessionKey: input.sessionKey,
            tavernAgentId: input.senderType === 'agent' ? 'agent-1' : null,
            timestamp: '2026-06-26T15:00:00.000Z',
        },
        responseId: input.responseId,
    } as ChatMessageRow;
    const entry = {
        actor,
        id: input.id,
        items: [{ kind: 'row', row }],
        key: `${input.participant}:${input.sessionKey}`,
        kind: 'turn',
        participant: input.participant,
        responseId: input.responseId ?? null,
        timestamp: '2026-06-26T15:00:00.000Z',
    } satisfies Extract<TranscriptEntry, { kind: 'turn' }>;

    return {
        entry,
        followsRuntimeNotice: false,
        id: input.id,
        kind: 'entry',
        showPresence: false,
        turnStartedAt: null,
    };
}

function activeAgentTurnRow(id: string, sessionKey: string): TranscriptRenderRow {
    return {
        entry: {
            actor: { id: 'agent-1', kind: 'agent' },
            id,
            items: [
                {
                    kind: 'activeStatus',
                    reply: {
                        agentId: 'agent-1',
                        isThinking: true,
                        runId: 'run-1',
                        sessionKey,
                        startedAt: '2026-06-26T15:00:01.000Z',
                        text: '',
                    },
                    status: 'thinking',
                },
            ],
            key: `agent:${sessionKey}`,
            kind: 'turn',
            participant: 'agent',
            responseId: null,
            timestamp: '2026-06-26T15:00:01.000Z',
        },
        followsRuntimeNotice: false,
        id,
        kind: 'entry',
        showPresence: true,
        turnStartedAt: '2026-06-26T15:00:00.000Z',
    };
}
