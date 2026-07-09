import type { AgentRuntimeModelName } from '@tavern/api';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import {
    createChat,
    createMessage,
    getResponseActivity,
    upsertResponse,
} from './chat-api/index.ts';
import {
    messageActivityIdForRun,
    persistHarnessTurnStream,
    reasoningActivityIdForRun,
    toolActivityIdForRun,
} from './harness-turn-stream.ts';

const chatId = 'cht_stream';
const responseId = 'rsp_stream_1';
const runId = 'run_stream_1';
const model: AgentRuntimeModelName = { model: 'claude-opus-4-8', provider: 'claude' };

beforeEach(() => {
    ensureRuntimeSchema(initTestDb());
    createChat({
        id: chatId,
        kind: 'dm',
        participants: [
            { id: 'usr_alice', kind: 'user', label: 'Alice', metadata: {} },
            { id: 'agt_primary', kind: 'agent', label: 'Tavern', metadata: {} },
        ],
        title: chatId,
    });
    createMessage(chatId, {
        author_id: 'usr_alice',
        content: 'how are sales today?',
        id: 'msg_stream_1',
        role: 'user',
    });
    upsertResponse(chatId, {
        id: responseId,
        participant_id: 'agt_primary',
        request_message_id: 'msg_stream_1',
        status: 'running',
        summary: 'Working on it.',
    });
});

afterEach(() => {
    closeDb();
});

describe('persistHarnessTurnStream', () => {
    it('persists a running tool activity while the tool is still executing', async () => {
        const toolGate = createGate();
        const toolCallId = 'tool_1';

        async function* parts() {
            yield toolCallPart(toolCallId, 'bash', { command: 'ls' });
            await toolGate.opened;
            yield toolResultPart(toolCallId, 'bash', { command: 'ls' }, 'file.txt');
        }

        const outcome = persistHarnessTurnStream(target(), parts());
        const activityId = toolActivityIdForRun(runId, toolCallId);
        await waitForActivity(activityId);

        const running = getResponseActivity(activityId);
        expect(running?.status).toBe('running');
        expect(running?.kind).toBe('tool_call');
        expect(running?.title).toBe('terminal');
        expect(running?.detail).toBe('ls');
        expect(running?.completed_at).toBeNull();

        toolGate.open();
        const result = await outcome;

        const completed = getResponseActivity(activityId);
        expect(completed?.status).toBe('completed');
        expect(completed?.completed_at).not.toBeNull();
        expect(completed?.metadata).toMatchObject({
            tool: { arguments: { command: 'ls' }, name: 'bash', result: 'file.txt' },
        });
        expect(result.activityIds).toEqual([activityId]);
    });

    it('persists commentary as soon as a tool call proves it is not the final answer', async () => {
        const toolGate = createGate();

        async function* parts() {
            yield* textSegment('txt_1', 'I will pull the sales data.');
            yield toolCallPart('tool_1', 'merchbase_sales', { range: 'today' });
            await toolGate.opened;
            yield toolResultPart('tool_1', 'merchbase_sales', { range: 'today' }, { sold: 17 });
            yield* textSegment('txt_2', 'Sales today: 17 units.');
        }

        const outcome = persistHarnessTurnStream(target(), parts());
        const commentaryId = messageActivityIdForRun(runId, 0);
        await waitForActivity(commentaryId);

        const commentary = getResponseActivity(commentaryId);
        expect(commentary?.status).toBe('completed');
        expect(commentary?.kind).toBe('message');
        expect(commentary?.summary).toBe('I will pull the sales data.');

        toolGate.open();
        const result = await outcome;

        expect(result.finalText).toBe('Sales today: 17 units.');
        expect(getResponseActivity(messageActivityIdForRun(runId, 1))).toBeNull();
        expect(result.activityIds).toEqual([commentaryId, toolActivityIdForRun(runId, 'tool_1')]);
    });

    it('treats a single text segment as the final answer with no activity', async () => {
        async function* parts() {
            yield* textSegment('txt_only', 'Done.');
        }

        const result = await persistHarnessTurnStream(target(), parts());

        expect(result.finalText).toBe('Done.');
        expect(result.activityIds).toEqual([]);
        expect(result.contextTokens).toBeNull();
        expect(getResponseActivity(messageActivityIdForRun(runId, 0))).toBeNull();
    });

    it('reads context tokens from the final step usage, not the turn total', async () => {
        async function* parts() {
            yield {
                finishReason: 'tool-calls',
                type: 'finish-step',
                usage: usagePart(900, 40),
            };
            yield* textSegment('txt_final', 'Done.');
            yield {
                finishReason: 'stop',
                type: 'finish-step',
                usage: usagePart(1200, 80),
            };
            yield {
                finishReason: 'stop',
                totalUsage: usagePart(2100, 120),
                type: 'finish',
            };
        }

        const result = await persistHarnessTurnStream(target(), parts());

        expect(result.contextTokens).toBe(1280);
    });

    it('falls back to the finish total when no step reported usage', async () => {
        async function* parts() {
            yield* textSegment('txt_final', 'Done.');
            yield {
                finishReason: 'stop',
                totalUsage: usagePart(500, 25),
                type: 'finish',
            };
        }

        const result = await persistHarnessTurnStream(target(), parts());

        expect(result.contextTokens).toBe(525);
    });

    it('marks a tool activity failed when the tool errors', async () => {
        async function* parts() {
            yield toolCallPart('tool_err', 'bash', { command: 'boom' });
            yield {
                error: new Error('command failed'),
                input: { command: 'boom' },
                toolCallId: 'tool_err',
                toolName: 'bash',
                type: 'tool-error',
            };
            yield* textSegment('txt_after', 'It failed.');
        }

        const result = await persistHarnessTurnStream(target(), parts());

        const activity = getResponseActivity(toolActivityIdForRun(runId, 'tool_err'));
        expect(activity?.status).toBe('failed');
        expect(activity?.metadata).toMatchObject({
            tool: { error: 'command failed', name: 'bash' },
        });
        expect(result.finalText).toBe('It failed.');
    });

    it('throws the stream error after consuming the stream', async () => {
        async function* parts() {
            yield toolCallPart('tool_1', 'bash', { command: 'ls' });
            yield { error: new Error('harness exploded'), type: 'error' };
        }

        await expect(persistHarnessTurnStream(target(), parts())).rejects.toThrow(
            'harness exploded'
        );
        expect(getResponseActivity(toolActivityIdForRun(runId, 'tool_1'))?.status).toBe('running');
    });

    it('persists reasoning segments as reasoning activities', async () => {
        async function* parts() {
            yield { id: 'r1', type: 'reasoning-start' };
            yield { id: 'r1', text: 'The user wants ', type: 'reasoning-delta' };
            yield { id: 'r1', text: "today's sales.", type: 'reasoning-delta' };
            yield { id: 'r1', type: 'reasoning-end' };
            yield* textSegment('txt_1', 'Sales today: 17 units.');
        }

        const result = await persistHarnessTurnStream(target(), parts());

        const activity = getResponseActivity(reasoningActivityIdForRun(runId, 0));
        expect(activity?.kind).toBe('reasoning');
        expect(activity?.status).toBe('completed');
        expect(activity?.summary).toBe("The user wants today's sales.");
        expect(activity?.title).toBe('Reasoning');
        expect(result.finalText).toBe('Sales today: 17 units.');
        expect(result.activityIds).toEqual([reasoningActivityIdForRun(runId, 0)]);
    });

    it('flushes pending commentary when a reasoning segment follows it', async () => {
        async function* parts() {
            yield* textSegment('txt_1', 'Let me think about this.');
            yield { id: 'r1', type: 'reasoning-start' };
            yield { id: 'r1', text: 'Considering options.', type: 'reasoning-delta' };
            yield { id: 'r1', type: 'reasoning-end' };
            yield* textSegment('txt_2', 'Here is the answer.');
        }

        const result = await persistHarnessTurnStream(target(), parts());

        const commentary = getResponseActivity(messageActivityIdForRun(runId, 0));
        expect(commentary?.kind).toBe('message');
        expect(commentary?.summary).toBe('Let me think about this.');
        expect(result.finalText).toBe('Here is the answer.');
        expect(result.activityIds).toEqual([
            messageActivityIdForRun(runId, 0),
            reasoningActivityIdForRun(runId, 0),
        ]);
    });

    it('persists buffered narration and reasoning when the turn is stopped', async () => {
        async function* parts() {
            yield* textSegment('txt_1', 'I will inspect the workspace first.');
            yield { id: 'r1', type: 'reasoning-start' };
            yield { id: 'r1', text: 'Halfway through a thought', type: 'reasoning-delta' };
            yield { id: 'txt_2', type: 'text-start' };
            yield { id: 'txt_2', text: 'The workspace looks', type: 'text-delta' };
            yield { type: 'abort' };
        }

        await expect(persistHarnessTurnStream(target(), parts())).rejects.toThrow(/aborted/);

        const preamble = getResponseActivity(messageActivityIdForRun(runId, 0));
        expect(preamble?.kind).toBe('message');
        expect(preamble?.summary).toBe('I will inspect the workspace first.');

        const reasoning = getResponseActivity(reasoningActivityIdForRun(runId, 0));
        expect(reasoning?.summary).toBe('Halfway through a thought');

        const partial = getResponseActivity(messageActivityIdForRun(runId, 1));
        expect(partial?.kind).toBe('message');
        expect(partial?.summary).toBe('The workspace looks');
    });

    it('persists buffered narration when the stream iteration throws', async () => {
        async function* parts() {
            yield* textSegment('txt_1', 'Checking the layout now.');
            yield { id: 'txt_2', type: 'text-start' };
            yield { id: 'txt_2', text: 'Partial reply text', type: 'text-delta' };
            throw new Error('The operation was aborted.');
        }

        await expect(persistHarnessTurnStream(target(), parts())).rejects.toThrow(
            'The operation was aborted.'
        );

        expect(getResponseActivity(messageActivityIdForRun(runId, 0))?.summary).toBe(
            'Checking the layout now.'
        );
        expect(getResponseActivity(messageActivityIdForRun(runId, 1))?.summary).toBe(
            'Partial reply text'
        );
    });

    it('ignores unrelated stream part types', async () => {
        async function* parts() {
            yield { type: 'start' };
            yield { rawValue: { anything: true }, type: 'raw' };
            yield* textSegment('txt_1', 'Answer.');
            yield { finishReason: 'stop', type: 'finish' };
        }

        const result = await persistHarnessTurnStream(target(), parts());

        expect(result.finalText).toBe('Answer.');
        expect(result.activityIds).toEqual([]);
    });
});

function target() {
    return {
        authorId: 'agt_primary',
        chatId,
        model,
        responseId,
        runId,
        runtime: { runId, source: 'agent-engine' },
    };
}

function* textSegment(id: string, text: string) {
    yield { id, type: 'text-start' };
    yield { id, text, type: 'text-delta' };
    yield { id, type: 'text-end' };
}

function toolCallPart(toolCallId: string, toolName: string, input: unknown) {
    return { input, toolCallId, toolName, type: 'tool-call' };
}

function usagePart(inputTotal: number, outputTotal: number) {
    return {
        inputTokens: {
            cacheRead: undefined,
            cacheWrite: undefined,
            noCache: undefined,
            total: inputTotal,
        },
        outputTokens: { reasoning: undefined, text: undefined, total: outputTotal },
    };
}

function toolResultPart(toolCallId: string, toolName: string, input: unknown, output: unknown) {
    return { input, output, toolCallId, toolName, type: 'tool-result' };
}

function createGate() {
    let open: () => void = () => {};
    const opened = new Promise<void>((resolve) => {
        open = resolve;
    });
    return { open, opened };
}

async function waitForActivity(activityId: string) {
    for (let attempt = 0; attempt < 50; attempt += 1) {
        if (getResponseActivity(activityId)) {
            return;
        }
        await new Promise((resolve) => {
            setTimeout(resolve, 5);
        });
    }
    throw new Error(`Activity ${activityId} was not persisted while the stream was running.`);
}
