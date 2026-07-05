import type { generateText } from 'ai';
import { getDb } from '../db/connection.ts';
import { namedParams } from '../db/sqlite.ts';
import { upsertStoredAgent } from '../tavern/agents-store.ts';
import { createChat, createMessage } from '../tavern/chat-api/index.ts';
import { queueSkillReviewFromSignals } from './review-queue.ts';

export function configureStandardReviewModel() {
    getDb()
        .prepare(
            `INSERT INTO runtime_metadata (key, value, updated_at)
             VALUES ($key, $value, $now)`
        )
        .run(
            namedParams({
                key: 'models:category-settings',
                now: '2026-07-02T19:00:00.000Z',
                value: JSON.stringify({
                    categories: {
                        deep: null,
                        fast: null,
                        standard: {
                            baseUrl: 'http://127.0.0.1:1/v1',
                            model: 'review-test',
                            provider: 'openai-compatible',
                        },
                        visual: null,
                    },
                }),
            })
        );
}

export function seedReviewAgentChat(input: { enabledSkillIds: string[]; workspace: string }) {
    upsertStoredAgent({
        agent: {
            enabledSkillIds: input.enabledSkillIds,
            id: 'agt_primary',
            isAdmin: true,
            name: 'Tavern',
            primaryColor: null,
            workspaceFolder: input.workspace,
        },
        syncedAt: '2026-07-02T19:00:00.000Z',
    });
    createChat({
        id: 'cht_review',
        kind: 'channel',
        participants: [
            { id: 'usr_tavern', kind: 'user', label: 'You', metadata: {} },
            {
                id: 'agt_primary',
                kind: 'agent',
                label: 'Tavern',
                metadata: { agentId: 'agt_primary' },
            },
        ],
        title: 'Review',
    });
}

export function insertReviewWindowMessages() {
    createMessage('cht_review', {
        author_id: 'usr_tavern',
        content: 'Please remember the runtime test ordering.',
        id: 'msg_review_user',
        role: 'user',
    });
    createMessage('cht_review', {
        author_id: 'agt_primary',
        content: 'I will update the skill.',
        id: 'msg_review_agent',
        role: 'assistant',
    });
}

export function queueReview(input: {
    endSequence: number;
    signals: Parameters<typeof queueSkillReviewFromSignals>[0]['signals'];
    startSequence: number;
}) {
    queueSkillReviewFromSignals({
        agentId: 'agt_primary',
        chatId: 'cht_review',
        endSequence: input.endSequence,
        now: new Date('2026-07-02T20:00:00.000Z'),
        signals: input.signals,
        startSequence: input.startSequence,
    });
}

export function dueAt() {
    return new Date('2026-07-02T20:01:00.000Z');
}

export function readReviewQueue() {
    return getDb().prepare('SELECT * FROM skill_review_queue LIMIT 1').get();
}

export function readSkillReviewJobs() {
    return getDb()
        .prepare(
            `SELECT *
             FROM memory_jobs
             WHERE kind = 'skill_review'
             ORDER BY created_at ASC`
        )
        .all() as Array<{
        error: string | null;
        kind: string;
        metadata_json: string;
        model_category: string;
        source_end_sequence: number | null;
        source_start_sequence: number | null;
        status: string;
    }>;
}

export interface ModelToolCall {
    input: unknown;
    output: unknown;
    toolCallId: string;
    toolName: string;
}

type ToolExecute = (
    input: unknown,
    options: { context: unknown; messages: []; toolCallId: string }
) => Promise<unknown>;

type GenerateTextResult = Awaited<ReturnType<typeof generateText>>;

export async function runModelTool(
    config: unknown,
    calls: ModelToolCall[],
    toolName: string,
    input: unknown
) {
    const toolSet = (config as { tools: Record<string, { execute: ToolExecute }> }).tools;
    const toolCallId = `call_${calls.length + 1}`;
    const output = await toolSet[toolName]?.execute(input, {
        context: undefined,
        messages: [],
        toolCallId,
    });
    calls.push({ input, output, toolCallId, toolName });
    return output;
}

export function modelResult(input: { calls: ModelToolCall[]; text: string }): GenerateTextResult {
    return {
        text: input.text,
        toolCalls: input.calls.map(({ input: toolInput, toolCallId, toolName }) => ({
            input: toolInput,
            toolCallId,
            toolName,
        })),
        toolResults: input.calls.map(({ output, toolCallId, toolName }) => ({
            output,
            toolCallId,
            toolName,
        })),
        usage: { totalTokens: 42 },
    } as unknown as GenerateTextResult;
}

export function unwrapToolOutput(output: unknown) {
    const wrapped = output as { ok?: unknown; output?: unknown };
    return wrapped.ok === true ? wrapped.output : output;
}
