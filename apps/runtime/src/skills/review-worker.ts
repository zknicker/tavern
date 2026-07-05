import crypto from 'node:crypto';
import type { ToolSet } from '@ai-sdk/provider-utils';
import type { AgentRuntimeModelName } from '@tavern/api';
import { generateText, stepCountIs } from 'ai';
import { getDb } from '../db/connection.ts';
import { namedParams } from '../db/sqlite.ts';
import type { LearningSignal } from '../memory/extraction-worker.ts';
import {
    modelCategoryModelRef,
    resolveModelCategorySelection,
} from '../models/category-settings.ts';
import { createLanguageModelForRuntime } from '../models/language-model.ts';
import { createTavernSkillTools } from './agent-tools.ts';
import { buildSkillReviewPrompt, skillReviewInstructions } from './review-prompt.ts';
import type { SkillReviewQueueRow } from './review-queue.ts';
import {
    collectSkillReviewActions,
    collectSkillReviewToolErrors,
    fileChangesFromSkillReviewActions,
    type SkillReviewAction,
    serializeSkillReviewTranscript,
} from './review-report.ts';

export interface SkillReviewOutcome {
    actions: SkillReviewAction[];
    model: AgentRuntimeModelName;
    report: { text: string; toolErrors: Array<{ error: string; tool: string }> };
    transcript: unknown;
    usage: unknown;
}

export type SkillReviewModelWorker = (input: SkillReviewInput) => Promise<SkillReviewOutcome>;

export interface SkillReviewInput {
    agentId: string;
    chatId: string;
    jobId: string;
    signals: LearningSignal[];
    windowEndSequence: number | null;
    windowStartSequence: number | null;
}

let modelWorker: SkillReviewModelWorker = runAiSdkSkillReview;
let testingSkillsDir: string | undefined;

export async function runSkillReviewQueueRow(row: SkillReviewQueueRow, input: { now?: Date } = {}) {
    const now = input.now ?? new Date();
    const signals = parseSignals(row.signals_json);
    const model = resolveModelCategorySelection('standard');
    const jobId = createSkillReviewJob(row, { model, now });
    try {
        const outcome = await modelWorker({
            agentId: row.agent_id,
            chatId: row.chat_id,
            jobId,
            signals,
            windowEndSequence: row.window_end_sequence,
            windowStartSequence: row.window_start_sequence,
        });
        completeSkillReviewJob(jobId, {
            now: input.now ?? new Date(),
            outcome,
            signals,
        });
    } catch (error) {
        failSkillReviewJob(jobId, error, input.now ?? new Date());
        throw error;
    }
}

export function setSkillReviewModelWorkerForTesting(worker: SkillReviewModelWorker | null) {
    modelWorker = worker ?? runAiSdkSkillReview;
}

export function setSkillReviewSkillsDirForTesting(skillsDir: string | null) {
    testingSkillsDir = skillsDir ?? undefined;
}

export function resetSkillReviewWorkerForTesting() {
    modelWorker = runAiSdkSkillReview;
    testingSkillsDir = undefined;
}

export async function runAiSdkSkillReview(input: SkillReviewInput): Promise<SkillReviewOutcome> {
    const model = resolveModelCategorySelection('standard');
    const result = await generateText({
        model: await createLanguageModelForRuntime(model),
        prompt: await buildSkillReviewPrompt(input, {
            skillsDir: testingSkillsDir,
        }),
        stopWhen: stepCountIs(12),
        system: skillReviewInstructions,
        tools: wrapSkillTools(
            createTavernSkillTools({
                agentId: input.agentId,
                skillsDir: testingSkillsDir,
            })
        ),
    });
    const transcript = serializeSkillReviewTranscript(result);
    return {
        actions: collectSkillReviewActions(transcript),
        model,
        report: {
            text: result.text.trim(),
            toolErrors: collectSkillReviewToolErrors(transcript),
        },
        transcript,
        usage: result.usage ?? {},
    };
}

export function skillReviewModelRef(model: AgentRuntimeModelName) {
    return modelCategoryModelRef(model);
}

function wrapSkillTools(tools: ToolSet): ToolSet {
    return Object.fromEntries(
        Object.entries(tools).map(([name, value]) => {
            const entry = value as {
                execute?: (input: unknown, options: unknown) => Promise<unknown>;
            };
            if (typeof entry.execute !== 'function') {
                return [name, value];
            }
            return [
                name,
                {
                    ...entry,
                    execute: async (toolInput: unknown, options: unknown) => {
                        try {
                            return {
                                ok: true,
                                output: await entry.execute?.(toolInput, options),
                            };
                        } catch (error) {
                            return { error: formatError(error), ok: false };
                        }
                    },
                },
            ];
        })
    ) as ToolSet;
}

function createSkillReviewJob(
    row: SkillReviewQueueRow,
    input: { model: AgentRuntimeModelName; now: Date }
) {
    const jobId = `memskillreview_${crypto.randomUUID().replaceAll('-', '')}`;
    getDb()
        .prepare(
            `INSERT INTO memory_jobs (
                id, kind, status, chat_id, agent_id, model_category,
                model_json, source_start_sequence, source_end_sequence,
                metadata_json, created_at, updated_at, started_at
             )
             VALUES (
                $jobId, 'skill_review', 'running', $chatId, $agentId, 'standard',
                $modelJson, $startSequence, $endSequence,
                $metadataJson, $now, $now, $now
             )`
        )
        .run(
            namedParams({
                agentId: row.agent_id,
                chatId: row.chat_id,
                endSequence: row.window_end_sequence,
                jobId,
                metadataJson: JSON.stringify({
                    signals: parseSignals(row.signals_json),
                }),
                modelJson: JSON.stringify(input.model),
                now: input.now.toISOString(),
                startSequence: row.window_start_sequence,
            })
        );
    return jobId;
}

function completeSkillReviewJob(
    jobId: string,
    input: { now: Date; outcome: SkillReviewOutcome; signals: LearningSignal[] }
) {
    getDb()
        .prepare(
            `UPDATE memory_jobs
             SET status = 'completed',
                 model_json = $modelJson,
                 file_changes_json = $fileChangesJson,
                 usage_json = $usageJson,
                 transcript_json = $transcriptJson,
                 metadata_json = $metadataJson,
                 completed_at = $now,
                 updated_at = $now
             WHERE id = $jobId`
        )
        .run(
            namedParams({
                fileChangesJson: JSON.stringify(
                    fileChangesFromSkillReviewActions(input.outcome.actions)
                ),
                jobId,
                metadataJson: JSON.stringify({
                    actions: input.outcome.actions,
                    report: input.outcome.report,
                    signals: input.signals,
                }),
                modelJson: JSON.stringify(input.outcome.model),
                now: input.now.toISOString(),
                transcriptJson: JSON.stringify(input.outcome.transcript),
                usageJson: JSON.stringify(input.outcome.usage ?? {}),
            })
        );
}

function failSkillReviewJob(jobId: string, error: unknown, now: Date) {
    getDb()
        .prepare(
            `UPDATE memory_jobs
             SET status = 'failed',
                 error = $error,
                 completed_at = $now,
                 updated_at = $now
             WHERE id = $jobId`
        )
        .run(namedParams({ error: formatError(error), jobId, now: now.toISOString() }));
}

function parseSignals(value: string): LearningSignal[] {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? (parsed as LearningSignal[]) : [];
}

function formatError(error: unknown) {
    return error instanceof Error ? error.message : String(error);
}
