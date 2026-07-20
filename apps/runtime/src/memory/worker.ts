import type { AgentRuntimeModelName } from '@tavern/api';
import { generateText, stepCountIs, tool } from 'ai';
import * as z from 'zod';
import { getDb } from '../db/connection.ts';
import { namedParams } from '../db/sqlite.ts';
import { resolveModelCategorySelection } from '../models/category-settings.ts';
import { createLanguageModelForRuntime } from '../models/language-model.ts';
import { getStoredAgent } from '../tavern/agents-store.ts';
import {
    type EpisodicMemoryFile,
    listAgentEpisodicMemoryFiles,
    listWikiPages,
    readWikiFile,
    type WikiFileChange,
    writeWikiFile,
} from '../wiki/store.ts';
import {
    type AgentCoreMemoryFileChange,
    agentCoreMemoryFileNames,
    readAgentCoreMemoryFile,
    writeAgentCoreMemoryFile,
} from './core-memory.ts';

export interface MemoryDreamInput {
    agentId: string;
    jobId: string;
}

export type MemoryDreamFileChange = AgentCoreMemoryFileChange | WikiFileChange;

export interface MemoryDreamOutcome {
    fileChanges: MemoryDreamFileChange[];
    model: AgentRuntimeModelName;
    text: string;
    transcript: unknown;
    usage: unknown;
}

export type MemoryDreamWorker = (input: MemoryDreamInput) => Promise<MemoryDreamOutcome>;

export class MemoryDreamWorkerError extends Error {
    readonly fileChanges: MemoryDreamFileChange[];

    constructor(error: unknown, fileChanges: MemoryDreamFileChange[]) {
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
    const fileChanges: MemoryDreamFileChange[] = [];
    try {
        const result = await generateText({
            model: await createLanguageModelForRuntime(model),
            prompt: memoryDreamPrompt(),
            stopWhen: stepCountIs(16),
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

const episodicDreamInputMaxChars = 200_000;

function createMemoryDreamTools(input: MemoryDreamInput, fileChanges: MemoryDreamFileChange[]) {
    return {
        memory_list_episodic: tool({
            description: 'List this agent’s hidden episodic Memory files.',
            inputSchema: z.object({}),
            execute: async () =>
                capEpisodicFiles(
                    await listAgentEpisodicMemoryFiles({
                        agentId: input.agentId,
                        since: getLatestCompletedDreamDate(input.agentId),
                    })
                ),
        }),
        wiki_list: tool({
            description: 'List shared Wiki pages and folders.',
            inputSchema: z.object({}),
            execute: async () => await listWikiPages(),
        }),
        wiki_read: tool({
            description: 'Read one shared Wiki Markdown page with its current hash.',
            inputSchema: z.object({
                path: z.string().min(1),
            }),
            execute: async ({ path }) => await readWikiFile({ path }),
        }),
        wiki_write: tool({
            description:
                'Write one shared Wiki Markdown page using the hash returned by wiki_read.',
            inputSchema: z.object({
                content: z.string(),
                expectedHash: z.string().nullable(),
                path: z.string().min(1),
            }),
            execute: async ({ content, expectedHash, path }) => {
                const change = await writeWikiFile({ content, expectedHash, path });
                fileChanges.push(change);
                return change;
            },
        }),
        memory_read_core: tool({
            description:
                'Read this agent’s own USER.md or MEMORY.md core memory file with its current hash.',
            inputSchema: z.object({
                name: z.enum(agentCoreMemoryFileNames),
            }),
            execute: async ({ name }) =>
                await readAgentCoreMemoryFile({ agentId: input.agentId, name }),
        }),
        memory_write_core: tool({
            description:
                'Write this agent’s own USER.md or MEMORY.md core memory file using the hash returned by memory_read_core.',
            inputSchema: z.object({
                content: z.string(),
                expectedHash: z.string(),
                name: z.enum(agentCoreMemoryFileNames),
            }),
            execute: async ({ content, expectedHash, name }) => {
                const change = await writeAgentCoreMemoryFile({
                    agentId: input.agentId,
                    content,
                    expectedHash,
                    name,
                });
                fileChanges.push(change);
                return change;
            },
        }),
    };
}

/**
 * Bound the episodic evidence fed to one dream. Newest files win; older files
 * beyond the budget are dropped with an explicit note so the worker knows the
 * window was truncated.
 */
function capEpisodicFiles(files: EpisodicMemoryFile[]) {
    const newestFirst = [...files].sort((left, right) => right.path.localeCompare(left.path));
    const kept: EpisodicMemoryFile[] = [];
    let total = 0;
    for (const file of newestFirst) {
        if (kept.length > 0 && total + file.content.length > episodicDreamInputMaxChars) {
            break;
        }
        kept.push(file);
        total += file.content.length;
    }
    kept.sort((left, right) => left.path.localeCompare(right.path));
    return {
        files: kept,
        omittedFileCount: files.length - kept.length,
        truncated: kept.length < files.length,
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
        'You are Grotto’s background Memory dreaming worker.',
        `You maintain durable Memory for ${agentName}.`,
        'Do not answer the user. Do not use personality, SOUL, chat tools, shell, or workspace file tools.',
        'Use only the provided Memory and Wiki tools.',
        'Read episodic Memory, then promote only stable, useful, non-secret evidence. Route by TAXONOMY.md:',
        '- Durable shared knowledge goes to Wiki pages via wiki_write, routed to whatever folder TAXONOMY.md assigns the subject.',
        '- Stable user profile facts and preferences for this agent go to its USER.md via memory_write_core.',
        '- Durable operating rules that change this agent’s default behavior go to its MEMORY.md via memory_write_core.',
        'Core memory is loaded into every session start, so keep it compact: promote only high-value entries, merge duplicates, and prune stale lines while preserving user-authored content.',
        'Do not create or edit USER.md or MEMORY.md in the shared Wiki.',
        'For Wiki writes, preserve frontmatter and user-authored content where possible.',
        'Add evidence-backed History entries before changing Current.',
        'If there is nothing durable to promote, make no changes and say so briefly.',
    ].join('\n');
}

function memoryDreamPrompt() {
    return [
        'Review this agent’s episodic Memory, its core memory files, and the shared Wiki.',
        'Promote only durable, non-secret knowledge. Use write tools only with the latest expectedHash from the matching read tool.',
        'Your final text is shown to the user as this run’s summary. Keep it to one or two plain sentences about what changed; never mention job ids or internal identifiers.',
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
