import { describe, expect, it, mock } from 'bun:test';
import { createTurnProgressMapper } from './turn-progress.js';

describe('turn progress mapper', () => {
    it('maps OpenClaw command item events to durable response activity', async () => {
        const context = {
            tavern: {
                updateTurnActivity: mock(async () => ({})),
            },
        };
        const mapper = createTurnProgressMapper({
            context,
            input: {
                agentId: 'main',
                chatId: 'cht_1',
                messageId: 'msg_1',
                sessionKey: 'agent:main:tavern:channel:cht_1',
            },
            runId: 'run_1',
            startedAt: '2026-05-18T12:00:00.000Z',
        });

        mapper.handle({
            data: {
                itemId: 'call_123',
                kind: 'command',
                meta: 'list apps',
                name: 'computer-use.list_apps',
                phase: 'start',
                status: 'running',
                title: 'Command',
            },
            stream: 'item',
        });
        mapper.handle({
            data: {
                itemId: 'call_123',
                kind: 'command',
                meta: 'list apps',
                name: 'computer-use.list_apps',
                phase: 'end',
                status: 'failed',
                title: 'Command',
            },
            stream: 'item',
        });

        await flushPendingUpdates();

        expect(context.tavern.updateTurnActivity.mock.calls).toHaveLength(2);
        expect(
            context.tavern.updateTurnActivity.mock.calls.map(([, input]) => input)
        ).toMatchObject([
            {
                status: 'running',
                step: {
                    completed_at: null,
                    detail: null,
                    id: 'act_call_123',
                    kind: 'tool_call',
                    metadata: {
                        runtime: {
                            toolCallId: 'call_123',
                            toolName: 'computer-use.list_apps',
                        },
                        tool: {
                            arguments: null,
                            name: 'computer-use.list_apps',
                            result: null,
                        },
                        toolCallId: 'call_123',
                        toolName: 'computer-use.list_apps',
                    },
                    started_at: expect.any(String),
                    status: 'running',
                    title: 'computer use.list apps list apps',
                },
            },
            {
                status: 'running',
                step: {
                    completed_at: expect.any(String),
                    detail: null,
                    id: 'act_call_123',
                    kind: 'tool_call',
                    metadata: {
                        runtime: {
                            toolCallId: 'call_123',
                            toolName: 'computer-use.list_apps',
                        },
                        tool: {
                            arguments: null,
                            name: 'computer-use.list_apps',
                            result: null,
                        },
                        toolCallId: 'call_123',
                        toolName: 'computer-use.list_apps',
                    },
                    started_at: expect.any(String),
                    status: 'failed',
                    title: 'computer use.list apps list apps',
                },
            },
        ]);
    });

    it('preserves OpenClaw work item tool names when item progress is the concrete event', async () => {
        const context = {
            tavern: {
                updateTurnActivity: mock(async () => ({})),
            },
        };
        const mapper = createTurnProgressMapper({
            context,
            input: {
                agentId: 'main',
                chatId: 'cht_1',
                messageId: 'msg_1',
                sessionKey: 'agent:main:tavern:channel:cht_1',
            },
            runId: 'run_1',
            startedAt: '2026-05-18T12:00:00.000Z',
        });

        mapper.handle({
            data: {
                itemId: 'tool:call_mock_read_1|fc_mock_read_1',
                kind: 'tool',
                name: 'read',
                phase: 'end',
                status: 'completed',
                title: 'read from QA_KICKOFF_TASK.md',
            },
            stream: 'item',
        });
        mapper.handle({
            data: {
                itemId: 'tool:call_mock_read_1|fc_mock_read_1',
                text: '# QA kickoff task',
                toolCallId: 'call_mock_read_1',
            },
            stream: 'tool_result',
        });

        await flushPendingUpdates();

        expect(context.tavern.updateTurnActivity.mock.calls).toHaveLength(2);
        expect(context.tavern.updateTurnActivity.mock.calls[0][1]).toMatchObject({
            step: {
                kind: 'tool_call',
                metadata: {
                    runtime: {
                        toolName: 'read',
                    },
                    tool: {
                        arguments: null,
                        name: 'read',
                    },
                },
                status: 'completed',
                title: 'read from QA_KICKOFF_TASK.md',
            },
        });
        expect(context.tavern.updateTurnActivity.mock.calls[1][1]).toMatchObject({
            step: {
                detail: '# QA kickoff task',
                metadata: {
                    tool: {
                        arguments: null,
                        name: 'read',
                        result: '# QA kickoff task',
                    },
                },
            },
        });
    });

    it('updates command item rows from command output without creating a second row', async () => {
        const context = {
            tavern: {
                updateTurnActivity: mock(async () => ({})),
            },
        };
        const mapper = createTurnProgressMapper({
            context,
            input: {
                agentId: 'main',
                chatId: 'cht_1',
                messageId: 'msg_1',
                sessionKey: 'agent:main:tavern:channel:cht_1',
            },
            runId: 'run_1',
            startedAt: '2026-05-18T12:00:00.000Z',
        });

        mapper.handle({
            data: {
                itemId: 'call_123',
                kind: 'command',
                meta: 'run sleep 3',
                name: 'bash',
                phase: 'start',
                status: 'running',
                title: 'Command',
            },
            stream: 'item',
        });
        mapper.handle({
            data: {
                itemId: 'call_123',
                name: 'bash',
                output: 'done',
                phase: 'end',
                status: 'completed',
                toolCallId: 'call_123',
            },
            stream: 'command_output',
        });
        mapper.handle({
            data: {
                itemId: 'call_123',
                kind: 'command',
                name: 'bash',
                phase: 'end',
                status: 'completed',
                title: 'Command',
            },
            stream: 'item',
        });

        await flushPendingUpdates();

        const steps = context.tavern.updateTurnActivity.mock.calls
            .map(([, input]) => input.step)
            .filter(Boolean);

        expect(steps).toHaveLength(3);
        expect(steps.map((step) => step.title)).toEqual([
            'bash run sleep 3',
            'bash run sleep 3',
            'bash run sleep 3',
        ]);
        expect(JSON.stringify(steps)).not.toContain('Command');
        expect(steps.map((step) => step.status)).toEqual(['running', 'completed', 'completed']);
        expect(steps[1]).toMatchObject({
            id: 'act_call_123',
            detail: 'done',
            metadata: {
                runtime: {
                    toolCallId: 'call_123',
                    toolName: 'bash',
                },
                tool: {
                    arguments: null,
                    name: 'bash',
                    result: {
                        cwd: null,
                        durationMs: null,
                        exitCode: null,
                        output: 'done',
                        status: 'completed',
                    },
                },
            },
        });
    });

    it('ignores command output that does not match an existing command item row', async () => {
        const context = {
            tavern: {
                updateTurnActivity: mock(async () => ({})),
            },
        };
        const mapper = createTurnProgressMapper({
            context,
            input: {
                agentId: 'main',
                chatId: 'cht_1',
                messageId: 'msg_1',
                sessionKey: 'agent:main:tavern:channel:cht_1',
            },
            runId: 'run_1',
            startedAt: '2026-05-18T12:00:00.000Z',
        });

        mapper.handle({
            data: {
                itemId: 'call_123',
                name: 'bash',
                output: 'done',
                phase: 'end',
                status: 'completed',
                toolCallId: 'call_123',
            },
            stream: 'command_output',
        });

        await flushPendingUpdates();

        expect(context.tavern.updateTurnActivity).not.toHaveBeenCalled();
    });

    it('creates live tool activity from command item events when the tool stream is absent', async () => {
        const context = {
            tavern: {
                updateTurnActivity: mock(async () => ({})),
            },
        };
        const mapper = createTurnProgressMapper({
            context,
            input: {
                agentId: 'main',
                chatId: 'cht_1',
                messageId: 'msg_1',
                sessionKey: 'agent:main:tavern:channel:cht_1',
            },
            runId: 'run_1',
            startedAt: '2026-05-18T12:00:00.000Z',
        });

        mapper.handle({
            data: {
                itemId: 'call_123',
                kind: 'command',
                meta: 'run sleep 3 → print time (workspace)',
                name: 'bash',
                phase: 'start',
                status: 'running',
                title: 'Command',
            },
            stream: 'item',
        });

        await flushPendingUpdates();

        expect(context.tavern.updateTurnActivity.mock.calls).toHaveLength(1);
        expect(context.tavern.updateTurnActivity.mock.calls[0][1]).toMatchObject({
            step: {
                id: 'act_call_123',
                kind: 'tool_call',
                metadata: {
                    runtime: {
                        toolCallId: 'call_123',
                        toolName: 'bash',
                    },
                    tool: {
                        arguments: null,
                        name: 'bash',
                        result: null,
                    },
                },
                status: 'running',
                title: 'bash run sleep 3 → print time (workspace)',
            },
        });
        expect(JSON.stringify(context.tavern.updateTurnActivity.mock.calls)).not.toContain(
            'Command'
        );
    });

    it('maps Codex commentary preamble item events to assistant message activity', async () => {
        const context = {
            tavern: {
                updateTurnActivity: mock(async () => ({})),
            },
        };
        const mapper = createTurnProgressMapper({
            context,
            input: {
                agentId: 'main',
                chatId: 'cht_1',
                messageId: 'msg_1',
                sessionKey: 'agent:main:tavern:channel:cht_1',
            },
            runId: 'run_1',
            startedAt: '2026-05-18T12:00:00.000Z',
        });

        mapper.handle({
            data: {
                itemId: 'msg_preamble_1',
                kind: 'preamble',
                phase: 'update',
                progressText: 'I will inspect the workspace before replying.',
                source: 'codex-app-server',
                title: 'Preamble',
            },
            stream: 'item',
        });

        await flushPendingUpdates();

        expect(context.tavern.updateTurnActivity.mock.calls).toHaveLength(1);
        expect(context.tavern.updateTurnActivity.mock.calls[0][1]).toMatchObject({
            status: 'running',
            step: {
                detail: 'I will inspect the workspace before replying.',
                id: 'act_msg_preamble_1',
                kind: 'message',
                status: 'running',
                title: 'Assistant reply',
            },
        });
    });

    it('keeps separate streamed assistant preamble item ids and ignores raw assistant echoes', async () => {
        const context = {
            tavern: {
                updateTurnActivity: mock(async () => ({})),
            },
        };
        const mapper = createTurnProgressMapper({
            context,
            input: {
                agentId: 'main',
                chatId: 'cht_1',
                messageId: 'msg_1',
                sessionKey: 'agent:main:tavern:channel:cht_1',
            },
            runId: 'run_1',
            startedAt: '2026-05-18T12:00:00.000Z',
        });

        mapper.handle({
            data: {
                itemId: 'msg_preamble_1',
                kind: 'preamble',
                phase: 'update',
                progressText: 'I will run a timed shell check before the final reply.',
                source: 'codex-app-server',
                title: 'Preamble',
            },
            stream: 'item',
        });
        mapper.handle({
            data: {
                itemId: 'raw-assistant-2',
                kind: 'preamble',
                phase: 'update',
                progressText: 'I will run a timed shell check before the final reply.',
                source: 'codex-app-server',
                title: 'Preamble',
            },
            stream: 'item',
        });
        mapper.handle({
            data: {
                itemId: 'msg_preamble_2',
                kind: 'preamble',
                phase: 'update',
                progressText: 'The timed check finished. I will inspect the output next.',
                source: 'codex-app-server',
                title: 'Preamble',
            },
            stream: 'item',
        });

        await flushPendingUpdates();

        expect(context.tavern.updateTurnActivity.mock.calls).toHaveLength(2);
        expect(
            context.tavern.updateTurnActivity.mock.calls.map(([, input]) => input)
        ).toMatchObject([
            {
                step: {
                    detail: 'I will run a timed shell check before the final reply.',
                    id: 'act_msg_preamble_1',
                    kind: 'message',
                    title: 'Assistant reply',
                },
            },
            {
                step: {
                    detail: 'The timed check finished. I will inspect the output next.',
                    id: 'act_msg_preamble_2',
                    kind: 'message',
                    title: 'Assistant reply',
                },
            },
        ]);
    });

    it('ignores raw assistant preamble transcript echoes', async () => {
        const context = {
            tavern: {
                updateTurnActivity: mock(async () => ({})),
            },
        };
        const mapper = createTurnProgressMapper({
            context,
            input: {
                agentId: 'main',
                chatId: 'cht_1',
                messageId: 'msg_1',
                sessionKey: 'agent:main:tavern:channel:cht_1',
            },
            runId: 'run_1',
            startedAt: '2026-05-18T12:00:00.000Z',
        });

        mapper.handle({
            data: {
                itemId: 'raw-assistant-2',
                kind: 'preamble',
                phase: 'update',
                progressText: 'I will inspect the workspace before replying.',
                source: 'codex-app-server',
                title: 'Preamble',
            },
            stream: 'item',
        });

        await flushPendingUpdates();

        expect(context.tavern.updateTurnActivity.mock.calls).toHaveLength(0);
    });

    it('ignores raw assistant message transcript item events', async () => {
        const context = {
            tavern: {
                updateTurnActivity: mock(async () => ({})),
            },
        };
        const mapper = createTurnProgressMapper({
            context,
            input: {
                agentId: 'main',
                chatId: 'cht_1',
                messageId: 'msg_1',
                sessionKey: 'agent:main:tavern:channel:cht_1',
            },
            runId: 'run_1',
            startedAt: '2026-05-18T12:00:00.000Z',
        });

        mapper.handle({
            data: {
                id: 'raw-assistant-2',
                kind: 'message',
                phase: 'update',
                progressText: 'I will inspect the workspace before replying.',
                title: 'Assistant reply',
            },
            stream: 'item',
        });

        await flushPendingUpdates();

        expect(context.tavern.updateTurnActivity.mock.calls).toHaveLength(0);
    });

    it('maps unknown stable item events to custom activity rows', async () => {
        const context = {
            tavern: {
                updateTurnActivity: mock(async () => ({})),
            },
        };
        const mapper = createTurnProgressMapper({
            context,
            input: {
                agentId: 'main',
                chatId: 'cht_1',
                messageId: 'msg_1',
                sessionKey: 'agent:main:tavern:channel:cht_1',
            },
            runId: 'run_1',
            startedAt: '2026-05-18T12:00:00.000Z',
        });

        mapper.handle({
            data: {
                itemId: 'item_unexpected_1',
                kind: 'workspace_scan',
                phase: 'update',
                progressText: 'Scanned the temporary workspace.',
                status: 'running',
                title: 'Workspace scan',
            },
            stream: 'item',
        });

        await flushPendingUpdates();

        expect(context.tavern.updateTurnActivity.mock.calls).toHaveLength(1);
        expect(context.tavern.updateTurnActivity.mock.calls[0][1]).toMatchObject({
            step: {
                detail: 'Scanned the temporary workspace.',
                id: 'act_item_unexpected_1',
                kind: 'custom',
                metadata: {
                    runtime: {
                        openClawKind: 'workspace_scan',
                    },
                },
                status: 'running',
                title: 'Workspace scan',
            },
        });
    });

    it('maps analysis item events to reasoning activity rows', async () => {
        const context = {
            tavern: {
                updateTurnActivity: mock(async () => ({})),
            },
        };
        const mapper = createTurnProgressMapper({
            context,
            input: {
                agentId: 'main',
                chatId: 'cht_1',
                messageId: 'msg_1',
                sessionKey: 'agent:main:tavern:channel:cht_1',
            },
            runId: 'run_1',
            startedAt: '2026-05-18T12:00:00.000Z',
        });

        mapper.handle({
            data: {
                itemId: 'analysis_1',
                kind: 'analysis',
                progressText: 'Reasoning summary visible to the app.',
                status: 'completed',
                title: 'Reasoning',
            },
            stream: 'item',
        });

        await flushPendingUpdates();

        expect(context.tavern.updateTurnActivity.mock.calls).toHaveLength(1);
        expect(context.tavern.updateTurnActivity.mock.calls[0][1]).toMatchObject({
            step: {
                detail: 'Reasoning summary visible to the app.',
                id: 'act_analysis_1',
                kind: 'reasoning',
                metadata: {
                    runtime: {
                        openClawKind: 'analysis',
                    },
                },
                status: 'completed',
                title: 'Reasoning',
            },
        });
    });

    it('ignores analysis lifecycle item events without visible reasoning text', async () => {
        const context = {
            tavern: {
                updateTurnActivity: mock(async () => ({})),
            },
        };
        const mapper = createTurnProgressMapper({
            context,
            input: {
                agentId: 'main',
                chatId: 'cht_1',
                messageId: 'msg_1',
                sessionKey: 'agent:main:tavern:channel:cht_1',
            },
            runId: 'run_1',
            startedAt: '2026-05-18T12:00:00.000Z',
        });

        mapper.handle({
            data: {
                itemId: 'rs_01e1d5a2ba33f641016a12640b77c081969592e5df6c7baca4',
                kind: 'analysis',
                phase: 'start',
                status: 'running',
                title: 'Reasoning',
            },
            stream: 'item',
        });
        mapper.handle({
            data: {
                itemId: 'rs_01e1d5a2ba33f641016a12640b77c081969592e5df6c7baca4',
                kind: 'analysis',
                phase: 'end',
                status: 'completed',
                title: 'Reasoning',
            },
            stream: 'item',
        });

        await flushPendingUpdates();

        expect(context.tavern.updateTurnActivity.mock.calls).toHaveLength(0);
    });

    it('maps patch item events to artifact activity rows', async () => {
        const context = {
            tavern: {
                updateTurnActivity: mock(async () => ({})),
            },
        };
        const mapper = createTurnProgressMapper({
            context,
            input: {
                agentId: 'main',
                chatId: 'cht_1',
                messageId: 'msg_1',
                sessionKey: 'agent:main:tavern:channel:cht_1',
            },
            runId: 'run_1',
            startedAt: '2026-05-18T12:00:00.000Z',
        });

        mapper.handle({
            data: {
                itemId: 'patch_1',
                kind: 'patch',
                phase: 'end',
                status: 'completed',
                summary: 'Edited probe.txt',
                title: 'File change',
            },
            stream: 'item',
        });

        await flushPendingUpdates();

        expect(context.tavern.updateTurnActivity.mock.calls).toHaveLength(1);
        expect(context.tavern.updateTurnActivity.mock.calls[0][1]).toMatchObject({
            step: {
                detail: 'Edited probe.txt',
                id: 'act_patch_1',
                kind: 'artifact',
                status: 'completed',
                title: 'File change',
            },
        });
    });

    it('uses the normalized OpenClaw tool call id as the canonical id for wrapped tool item events', async () => {
        const context = {
            tavern: {
                updateTurnActivity: mock(async () => ({})),
            },
        };
        const mapper = createTurnProgressMapper({
            context,
            input: {
                agentId: 'main',
                chatId: 'cht_1',
                messageId: 'msg_1',
                sessionKey: 'agent:main:tavern:channel:cht_1',
            },
            runId: 'run_1',
            startedAt: '2026-05-18T12:00:00.000Z',
        });

        mapper.handle({
            data: {
                itemId: 'tool:call_mock_read_123|fc_mock_read_123',
                kind: 'tool',
                name: 'read',
                phase: 'start',
                status: 'running',
                title: 'read from QA_KICKOFF_TASK.md',
            },
            stream: 'item',
        });
        mapper.handle({
            data: {
                itemId: 'tool:call_mock_read_123|fc_mock_read_123',
                text: '# QA kickoff task',
                toolCallId: 'call_mock_read_123',
            },
            stream: 'tool_result',
        });

        await flushPendingUpdates();

        const steps = context.tavern.updateTurnActivity.mock.calls.map(([, input]) => input.step);

        expect(steps).toHaveLength(2);
        expect(steps.map((step) => step.id)).toEqual([
            'act_call_mock_read_123',
            'act_call_mock_read_123',
        ]);
        expect(steps[1]).toMatchObject({
            detail: '# QA kickoff task',
            metadata: {
                runtime: {
                    openClawIds: {
                        callId: null,
                        id: null,
                        itemId: 'tool:call_mock_read_123|fc_mock_read_123',
                        providerItemId: 'fc_mock_read_123',
                        toolCallId: 'call_mock_read_123',
                    },
                    toolCallId: 'call_mock_read_123',
                    toolName: 'read',
                },
                tool: {
                    name: 'read',
                    result: '# QA kickoff task',
                },
            },
        });
    });

    it('ignores tool-like item events without a normalized OpenClaw tool call id', async () => {
        const context = {
            tavern: {
                updateTurnActivity: mock(async () => ({})),
            },
        };
        const mapper = createTurnProgressMapper({
            context,
            input: {
                agentId: 'main',
                chatId: 'cht_1',
                messageId: 'msg_1',
                sessionKey: 'agent:main:tavern:channel:cht_1',
            },
            runId: 'run_1',
            startedAt: '2026-05-18T12:00:00.000Z',
        });

        mapper.handle({
            data: {
                itemId: 'tool_without_call_id',
                kind: 'tool',
                name: 'read',
                phase: 'start',
                status: 'running',
                title: 'read from QA_KICKOFF_TASK.md',
            },
            stream: 'item',
        });

        await flushPendingUpdates();

        expect(context.tavern.updateTurnActivity).not.toHaveBeenCalled();
    });

    it('maps approval events to approval activity', async () => {
        const context = {
            tavern: {
                updateTurnActivity: mock(async () => ({})),
            },
        };
        const mapper = createTurnProgressMapper({
            context,
            input: {
                agentId: 'main',
                chatId: 'cht_1',
                messageId: 'msg_1',
                sessionKey: 'agent:main:tavern:channel:cht_1',
            },
            runId: 'run_1',
            startedAt: '2026-05-18T12:00:00.000Z',
        });

        mapper.handle({
            data: {
                itemId: 'approval_1',
                message: 'Allow bash to edit files?',
                phase: 'start',
                title: 'Review command',
            },
            stream: 'approval',
        });

        await flushPendingUpdates();

        expect(context.tavern.updateTurnActivity.mock.calls).toHaveLength(1);
        expect(context.tavern.updateTurnActivity.mock.calls[0][1]).toMatchObject({
            step: {
                detail: 'Allow bash to edit files?',
                id: 'act_approval_1',
                kind: 'approval',
                status: 'running',
                title: 'Review command',
            },
        });
    });

    it('maps patch summaries to artifact activity', async () => {
        const context = {
            tavern: {
                updateTurnActivity: mock(async () => ({})),
            },
        };
        const mapper = createTurnProgressMapper({
            context,
            input: {
                agentId: 'main',
                chatId: 'cht_1',
                messageId: 'msg_1',
                sessionKey: 'agent:main:tavern:channel:cht_1',
            },
            runId: 'run_1',
            startedAt: '2026-05-18T12:00:00.000Z',
        });

        mapper.handle({
            data: {
                itemId: 'patch_1',
                modified: ['apps/website/src/features/chats/chat-transcript.tsx'],
                phase: 'end',
                title: 'Patch',
            },
            stream: 'patch',
        });

        await flushPendingUpdates();

        expect(context.tavern.updateTurnActivity.mock.calls).toHaveLength(1);
        expect(context.tavern.updateTurnActivity.mock.calls[0][1]).toMatchObject({
            step: {
                detail: 'modified apps/website/src/features/chats/chat-transcript.tsx',
                id: 'act_patch_1',
                kind: 'artifact',
                status: 'completed',
                title: 'Patch',
            },
        });
    });
});

async function flushPendingUpdates() {
    await Promise.resolve();
    await Promise.resolve();
}
