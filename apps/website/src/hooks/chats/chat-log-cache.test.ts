import { expect, test } from 'bun:test';
import type { ChatLogOutput } from '../../lib/trpc.tsx';
import { patchChatLogWithProgress, patchChatLogWithSteerNotice } from './chat-log-cache.ts';

const turn = {
    agentId: 'main',
    chatId: 'chat-1',
    runId: 'run-1',
    sessionKey: 'agent:main:tavern:channel:chat-1',
    startedAt: '2026-05-22T19:00:00.000Z',
};

function emptyLog(): ChatLogOutput {
    return {
        activeReply: null,
        limit: 100,
        nextBeforeSequence: null,
        rows: [],
        totalMessages: 0,
    };
}

test('progress patch inserts assistant progress as a prose message row', () => {
    const log = patchChatLogWithProgress(emptyLog(), {
        step: {
            detail: 'I will run a timed shell check before the final reply.',
            id: 'preamble-1',
            kind: 'message',
            label: 'Assistant reply',
            status: 'active',
        },
        timestamp: '2026-05-22T19:00:01.000Z',
        turn,
    });

    expect(log?.rows).toHaveLength(1);
    expect(log?.rows[0]).toMatchObject({
        id: 'act_run-1_preamble-1',
        kind: 'message',
        message: {
            content: 'I will run a timed shell check before the final reply.',
            senderType: 'agent',
            sourceSessionKey: turn.sessionKey,
            timestamp: '2026-05-22T19:00:01.000Z',
        },
    });
});

test('progress patch waits for query data before patching the cache', () => {
    const log = patchChatLogWithProgress(undefined, {
        step: {
            detail: 'I will run a timed shell check before the final reply.',
            id: 'preamble-1',
            kind: 'message',
            label: 'Assistant reply',
            status: 'active',
        },
        timestamp: '2026-05-22T19:00:01.000Z',
        turn,
    });

    expect(log).toBeUndefined();
});

test('progress patch updates an existing activity row without replacing its start time', () => {
    const running = patchChatLogWithProgress(emptyLog(), {
        step: {
            id: 'tool-call-1',
            kind: 'tool',
            label: "Used sleep 5; printf 'done\\n'",
            status: 'active',
            toolCallId: 'tool-call-1',
            toolName: 'bash',
        },
        timestamp: '2026-05-22T19:00:01.000Z',
        turn,
    });
    const completed = patchChatLogWithProgress(running, {
        step: {
            detail: 'completed 5.0s',
            id: 'tool-call-1',
            kind: 'tool',
            label: 'Used /bin/zsh -lc "sleep 5; printf \'done\\n\'"',
            status: 'completed',
            toolCallId: 'tool-call-1',
            toolName: 'bash',
        },
        timestamp: '2026-05-22T19:00:06.000Z',
        turn,
    });

    expect(completed?.totalMessages).toBe(0);
    expect(completed?.rows[0]).toMatchObject({
        completedAt: '2026-05-22T19:00:06.000Z',
        id: 'act_run-1_tool-call-1',
        startedAt: '2026-05-22T19:00:01.000Z',
        toolCall: {
            facts: [
                {
                    label: 'Command',
                    value: '/bin/zsh -lc "sleep 5; printf \'done\\n\'"',
                },
            ],
            name: 'bash',
            summaryParts: ['/bin/zsh -lc "sleep 5; printf \'done\\n\'"'],
        },
    });
});

test('progress patch renders live reasoning as one thinking row instead of a tool row', () => {
    const first = patchChatLogWithProgress(emptyLog(), {
        step: {
            detail: 'I should',
            id: 'reasoning',
            kind: 'reasoning',
            label: 'Thinking',
            status: 'active',
        },
        timestamp: '2026-05-22T19:00:01.000Z',
        turn,
    });
    const second = patchChatLogWithProgress(first, {
        step: {
            detail: 'I should answer directly.',
            id: 'reasoning',
            kind: 'reasoning',
            label: 'Thinking',
            status: 'active',
        },
        timestamp: '2026-05-22T19:00:02.000Z',
        turn,
    });

    expect(second?.totalMessages).toBe(0);
    expect(second?.rows[0]).toMatchObject({
        id: 'act_run-1_reasoning',
        kind: 'system',
        systemKind: 'thinking',
        thinking: {
            text: 'I should answer directly.',
            timestamp: '2026-05-22T19:00:01.000Z',
        },
    });
});

test('progress patch keeps preamble and normalized Hermes tool activity stable through completion', () => {
    const withPreamble = patchChatLogWithProgress(emptyLog(), {
        step: {
            detail: 'I will run a timed shell check before the final reply.',
            id: 'assistant-preamble',
            kind: 'message',
            label: 'Assistant reply',
            status: 'active',
        },
        timestamp: '2026-05-22T19:00:01.000Z',
        turn,
    });
    const withRunningTool = patchChatLogWithProgress(withPreamble, {
        step: {
            id: 'call_mock_read_123',
            kind: 'tool',
            label: 'read from QA_KICKOFF_TASK.md',
            status: 'active',
            toolCallId: 'call_mock_read_123',
            toolName: 'read',
        },
        timestamp: '2026-05-22T19:00:02.000Z',
        turn,
    });
    const completed = patchChatLogWithProgress(withRunningTool, {
        step: {
            detail: '# QA kickoff task',
            id: 'call_mock_read_123',
            kind: 'tool',
            label: 'read from QA_KICKOFF_TASK.md',
            status: 'completed',
            toolCallId: 'call_mock_read_123',
            toolName: 'read',
        },
        timestamp: '2026-05-22T19:00:06.000Z',
        turn,
    });

    expect(completed?.totalMessages).toBe(0);
    expect(completed?.rows.map((row) => row.id)).toEqual([
        'act_run-1_assistant-preamble',
        'act_run-1_call_mock_read_123',
    ]);
    expect(completed?.rows[0]).toMatchObject({
        kind: 'message',
        message: {
            content: 'I will run a timed shell check before the final reply.',
            sourceSessionKey: turn.sessionKey,
        },
    });
    expect(completed?.rows[1]).toMatchObject({
        completedAt: '2026-05-22T19:00:06.000Z',
        startedAt: '2026-05-22T19:00:02.000Z',
        toolCall: {
            callId: 'call_mock_read_123',
            name: 'read',
            summaryParts: ['from QA_KICKOFF_TASK.md'],
        },
    });
});

test('progress patch inserts a notice step as a runtime-notice system row', () => {
    const log = patchChatLogWithProgress(emptyLog(), {
        step: {
            detail: 'Credits low.',
            id: 'run-1_notice_credits',
            kind: 'notice',
            label: 'Agent notice',
            status: 'active',
        },
        timestamp: '2026-05-22T19:00:01.000Z',
        turn,
    });

    expect(log?.rows).toHaveLength(1);
    expect(log?.rows[0]).toMatchObject({
        id: 'act_run-1_notice_credits',
        kind: 'system',
        runtimeNotice: {
            kind: 'status',
            text: 'Credits low.',
            title: 'Agent notice',
        },
        systemKind: 'runtimeNotice',
    });
});

test('progress patch inserts a widget row for live widget progress', () => {
    const log = patchChatLogWithProgress(emptyLog(), {
        step: {
            detail: 'Quarterly Revenue',
            id: 'act_run-1_widget_chart',
            kind: 'widget',
            label: 'render_bar_chart',
            status: 'completed',
            widget: {
                component: 'tavern.render_bar_chart',
                fallbackText: 'Quarterly Revenue',
                id: 'act_run-1_widget_chart',
                props: {
                    data: [{ quarter: 'Q1', revenue: 12_000 }],
                    series: [{ key: 'revenue', label: 'Revenue' }],
                    title: 'Quarterly Revenue',
                    xKey: 'quarter',
                },
                target: 'chat.inline',
                validationError: null,
            },
        },
        timestamp: '2026-05-22T19:00:03.000Z',
        turn,
    });

    expect(log?.rows).toHaveLength(1);
    expect(log?.rows[0]).toMatchObject({
        completedAt: '2026-05-22T19:00:03.000Z',
        id: 'act_run-1_widget_chart',
        kind: 'widget',
        sessionKey: turn.sessionKey,
        widget: {
            component: 'tavern.render_bar_chart',
            fallbackText: 'Quarterly Revenue',
            props: {
                title: 'Quarterly Revenue',
                xKey: 'quarter',
            },
            target: 'chat.inline',
            validationError: null,
        },
    });
});

test('steer patch inserts the accepted steer as a user message row', () => {
    const log = patchChatLogWithSteerNotice(emptyLog(), {
        content: 'nvm do LA',
        runId: 'run-1',
        timestamp: '2026-05-22T19:00:03.000Z',
    });

    expect(log?.totalMessages).toBe(0);
    expect(log?.rows).toHaveLength(1);
    expect(log?.rows[0]).toMatchObject({
        id: 'act_run-1_runtime_notice_steered_message',
        kind: 'message',
        message: {
            content: 'nvm do LA',
            sender: 'You',
            senderType: 'user',
            timestamp: '2026-05-22T19:00:03.000Z',
        },
    });
});

test('progress patch inserts a visible steer message without a system notice', () => {
    const log = patchChatLogWithProgress(emptyLog(), {
        step: {
            detail: 'actually la',
            id: 'act_run-1_runtime_notice_steered',
            kind: 'notice',
            label: 'Steered active turn',
            status: 'completed',
        },
        timestamp: '2026-05-22T19:00:03.000Z',
        turn,
    });

    expect(log?.rows.map((row) => row.id)).toEqual(['act_run-1_runtime_notice_steered_message']);
    expect(log?.rows[0]).toMatchObject({
        kind: 'message',
        message: {
            content: 'actually la',
            sender: 'You',
            senderType: 'user',
        },
    });
});

test('progress patch tracks a worker step through running and completed states', () => {
    const running = patchChatLogWithProgress(emptyLog(), {
        step: {
            id: 'run-1_subagent_sub_1',
            kind: 'worker',
            label: 'Summarize the repo',
            status: 'active',
        },
        timestamp: '2026-05-22T19:00:01.000Z',
        turn,
    });
    const completed = patchChatLogWithProgress(running, {
        step: {
            detail: 'Summarized 12 files.',
            id: 'run-1_subagent_sub_1',
            kind: 'worker',
            label: 'Summarize the repo',
            status: 'completed',
        },
        timestamp: '2026-05-22T19:00:09.000Z',
        turn,
    });

    expect(completed?.rows).toHaveLength(1);
    expect(completed?.rows[0]).toMatchObject({
        completedAt: '2026-05-22T19:00:09.000Z',
        id: 'act_run-1_subagent_sub_1',
        kind: 'worker',
        startedAt: '2026-05-22T19:00:01.000Z',
        worker: {
            detail: 'Summarized 12 files.',
            kind: 'subagent',
            status: 'succeeded',
            title: 'Summarize the repo',
        },
    });
});

test('progress patch renders an approval step as a pending approval tool row', () => {
    const log = patchChatLogWithProgress(emptyLog(), {
        step: {
            detail: 'Dangerous delete',
            id: 'run-1_approval_1',
            kind: 'approval',
            label: 'Approval',
            status: 'active',
            toolName: 'approval',
        },
        timestamp: '2026-05-22T19:00:01.000Z',
        turn,
    });

    expect(log?.rows).toHaveLength(1);
    expect(log?.rows[0]).toMatchObject({
        completedAt: null,
        kind: 'tool',
        sessionKey: turn.sessionKey,
        toolCall: {
            name: 'approval',
            summaryParts: ['Dangerous delete'],
        },
    });
});

test('progress patch prefers the command detail over a bare tool-name label', () => {
    const log = patchChatLogWithProgress(emptyLog(), {
        step: {
            detail: "pwd && ls -la | sed -n '1,8p'",
            id: 'tool-call-2',
            kind: 'tool',
            label: 'terminal',
            status: 'active',
            toolCallId: 'tool-call-2',
            toolName: 'terminal',
        },
        timestamp: '2026-05-22T19:00:01.000Z',
        turn,
    });

    expect(log?.rows[0]).toMatchObject({
        kind: 'tool',
        toolCall: {
            name: 'terminal',
            summaryParts: ["pwd && ls -la | sed -n '1,8p'"],
        },
    });
});
