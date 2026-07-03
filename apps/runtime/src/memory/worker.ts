import type { AgentRuntimeModelName } from '@tavern/api';
import { generateText, stepCountIs, tool } from 'ai';
import * as z from 'zod';
import { getDb } from '../db/connection.ts';
import { namedParams } from '../db/sqlite.ts';
import { resolveModelCategorySelection } from '../models/category-settings.ts';
import { createLanguageModelForRuntime } from '../models/language-model.ts';
import { getStoredAgent } from '../tavern/agents-store.ts';
import {
    listAgentEpisodicMemoryFiles,
    listSemanticMemoryPages,
    readSemanticMemoryFile,
    type SemanticMemoryFileChange,
    writeSemanticMemoryFile,
} from './semantic/store.ts';

export interface MemoryDreamInput {
    agentId: string;
    jobId: string;
}

export interface MemoryDreamOutcome {
    fileChanges: SemanticMemoryFileChange[];
    model: AgentRuntimeModelName;
    text: string;
    transcript: unknown;
    usage: unknown;
}

export type MemoryDreamWorker = (input: MemoryDreamInput) => Promise<MemoryDreamOutcome>;

export class MemoryDreamWorkerError extends Error {
    readonly fileChanges: SemanticMemoryFileChange[];

    constructor(error: unknown, fileChanges: SemanticMemoryFileChange[]) {
        super(error instanceof Error ? error.message : String(error));
        this.name = 'MemoryDreamWorkerError';
        this.cause = error;
        this.fileChanges = fileChanges;
    }
}

export async function runAiSdkMemoryDream(input: MemoryDreamInput): Promise<MemoryDreamOutcome> {
    const agentRecord = getStoredAgent(input.agentId);
    if (!agentRecord) {
        throw new Error(`Agent "${input.agentId}" does not exist.`);
    }
    const model = resolveModelCategorySelection('standard');
    const fileChanges: SemanticMemoryFileChange[] = [];
    try {
        const result = await generateText({
            model: await createLanguageModelForRuntime(model),
            prompt: memoryDreamPrompt(input),
            stopWhen: stepCountIs(8),
            system: memoryDreamInstructions(agentRecord.name),
            tools: createMemoryDreamTools(input, fileChanges),
        });
        return {
            fileChanges,
            model,
            text: result.text,
            transcript: serializeWorkerTranscript(result),
            usage: result.usage ?? {},
        };
    } catch (error) {
        throw new MemoryDreamWorkerError(error, fileChanges);
    }
}

function createMemoryDreamTools(input: MemoryDreamInput, fileChanges: SemanticMemoryFileChange[]) {
    return {
        memory_list_episodic: tool({
            description: 'List this agent’s hidden episodic Memory files.',
            inputSchema: z.object({}),
            execute: async () => ({
                files: await listAgentEpisodicMemoryFiles({
                    agentId: input.agentId,
                    since: getLatestCompletedDreamDate(input.agentId),
                }),
            }),
        }),
        memory_list_pages: tool({
            description: 'List shared Semantic Memory pages and folders.',
            inputSchema: z.object({}),
            execute: async () => await listSemanticMemoryPages(),
        }),
        memory_read_page: tool({
            description: 'Read one shared Semantic Memory Markdown file with its current hash.',
            inputSchema: z.object({
                path: z.string().min(1),
            }),
            execute: async ({ path }) => await readSemanticMemoryFile({ path }),
        }),
        memory_write_page: tool({
            description:
                'Write one shared Semantic Memory Markdown file using the hash returned by memory_read_page.',
            inputSchema: z.object({
                content: z.string(),
                expectedHash: z.string().nullable(),
                path: z.string().min(1),
            }),
            execute: async ({ content, expectedHash, path }) => {
                const change = await writeSemanticMemoryFile({ content, expectedHash, path });
                fileChanges.push(change);
                return change;
            },
        }),
    };
}

function getLatestCompletedDreamDate(agentId: string) {
    const row = getDb()
        .prepare(
            `SELECT created_at
             FROM memory_jobs
             WHERE agent_id = $agentId
               AND kind = 'dream'
               AND status = 'completed'
             ORDER BY created_at DESC
             LIMIT 1`
        )
        .get(namedParams({ agentId })) as { created_at: string } | undefined;
    return row ? new Date(row.created_at) : null;
}

function memoryDreamInstructions(agentName: string) {
    return [
        'You are Tavern’s background Memory dreaming worker.',
        `You maintain durable Memory for ${agentName}.`,
        'Do not answer the user. Do not use personality, SOUL, chat tools, shell, or workspace file tools.',
        'Use only the provided Memory tools.',
        'Read episodic Memory, then update shared Semantic Memory only when evidence is stable and useful.',
        'Do not create or edit USER.md or MEMORY.md in shared Semantic Memory.',
        'For semantic writes, preserve frontmatter and user-authored content where possible.',
        'Add evidence-backed History entries before changing Current.',
        'If there is nothing durable to promote, make no changes and say so briefly.',
    ].join('\n');
}

function memoryDreamPrompt(input: MemoryDreamInput) {
    return [
        `Dream job: ${input.jobId}`,
        'Review this agent’s episodic Memory and shared Semantic Memory.',
        'Promote only durable, non-secret knowledge. Use memory_write_page only with the latest expectedHash from memory_read_page.',
    ].join('\n');
}

function serializeWorkerTranscript(result: {
    text: string;
    toolCalls: Array<{ input: unknown; toolCallId: string; toolName: string }>;
    toolResults: Array<{ output: unknown; toolCallId: string; toolName: string }>;
}) {
    return {
        text: result.text,
        toolCalls: result.toolCalls.map((call) => ({
            input: call.input,
            toolCallId: call.toolCallId,
            toolName: call.toolName,
        })),
        toolResults: result.toolResults.map((toolResult) => ({
            output: toolResult.output,
            toolCallId: toolResult.toolCallId,
            toolName: toolResult.toolName,
        })),
    };
}
