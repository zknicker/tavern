import type { ToolSet } from '@ai-sdk/provider-utils';
import type { AgentRuntimeModelName } from '@tavern/api';
import { generateText, stepCountIs } from 'ai';
import { agentEngineSkillsDir, listRuntimeSkills } from '../agent-engine/skill-library.ts';
import { getDb } from '../db/connection.ts';
import type { Database } from '../db/sqlite.ts';
import { namedParams } from '../db/sqlite.ts';
import {
    modelCategoryModelRef,
    resolveModelCategorySelection,
} from '../models/category-settings.ts';
import {
    createLanguageModelForRuntime,
    supportsLanguageModelForRuntime,
} from '../models/language-model.ts';
import { ensurePrimaryManagedAgent } from '../tavern/managed-agent.ts';
import { createCuratorSkillTools } from './agent-tools.ts';
import { skillCuratorInstructions } from './curator-prompt.ts';
import { collectCuratorActions, serializeCuratorTranscript } from './curator-report.ts';
import {
    type CuratorJobOutcome,
    completeCuratorJob,
    createCuratorJob,
    failCuratorJob,
    hasQueuedSkillReview,
    hasRunningAgentTurn,
    readRuntimeMetadata,
    skillCuratorMetadataKey,
    skipCuratorJob,
    writeRuntimeMetadata,
} from './curator-store.ts';
import { applySkillLifecycleTransitions } from './lifecycle.ts';
import { collectSkillReviewToolErrors } from './review-report.ts';
import { resolveSkillSource } from './store.ts';
import { readSkillUsageSummary } from './telemetry.ts';

export { skillCuratorMetadataKey } from './curator-store.ts';

const skillCuratorSweepIntervalMs = 60 * 60 * 1000;
export const skillCuratorCadenceMs = 7 * 24 * 60 * 60 * 1000;

export interface SkillCuratorOutcome extends CuratorJobOutcome {
    transcript: ReturnType<typeof serializeCuratorTranscript>;
}

export interface SkillCuratorInput {
    agentId: string;
    jobId: string;
}

export type SkillCuratorModelWorker = (input: SkillCuratorInput) => Promise<SkillCuratorOutcome>;

interface CuratorCandidate {
    description: string | null;
    id: string;
    lastUsedAt: string | null;
    name: string;
    state: string;
    useCount: number;
}

let sweepInterval: ReturnType<typeof setInterval> | null = null;
let processingPromise: Promise<{ completed: number; skipped: number }> | null = null;
let modelWorker: SkillCuratorModelWorker = runAiSdkSkillCurator;
let testingSkillsDir: string | undefined;

export async function processSkillCurator(input: { now?: Date } = {}) {
    if (processingPromise) {
        return await processingPromise;
    }
    processingPromise = processSkillCuratorOnce(input);
    try {
        return await processingPromise;
    } finally {
        processingPromise = null;
    }
}

export function startSkillCuratorScheduler() {
    if (sweepInterval) {
        return;
    }
    void processSkillCurator().catch(() => {});
    sweepInterval = setInterval(() => {
        void processSkillCurator().catch(() => {});
    }, skillCuratorSweepIntervalMs);
    sweepInterval.unref?.();
}

export function stopSkillCuratorScheduler() {
    if (sweepInterval) {
        clearInterval(sweepInterval);
        sweepInterval = null;
    }
    processingPromise = null;
}

export function setSkillCuratorModelWorkerForTesting(worker: SkillCuratorModelWorker | null) {
    modelWorker = worker ?? runAiSdkSkillCurator;
}

export function setSkillCuratorSkillsDirForTesting(skillsDir: string | null) {
    testingSkillsDir = skillsDir ?? undefined;
}

export function resetSkillCuratorForTesting() {
    stopSkillCuratorScheduler();
    modelWorker = runAiSdkSkillCurator;
    testingSkillsDir = undefined;
}

export function shouldRunSkillCurator(input: { db?: Database; now?: Date } = {}) {
    const db = input.db ?? getDb();
    const now = input.now ?? new Date();
    const lastRun = readRuntimeMetadata(skillCuratorMetadataKey, db);
    if (lastRun && now.getTime() - new Date(lastRun).getTime() < skillCuratorCadenceMs) {
        return { ok: false, reason: 'curation ran less than 7 days ago' };
    }
    if (hasRunningAgentTurn(db)) {
        return { ok: false, reason: 'runtime has a running agent turn' };
    }
    if (hasQueuedSkillReview(db)) {
        return { ok: false, reason: 'skill review queue is not empty' };
    }
    return { ok: true, reason: null };
}

export async function runSkillCuratorPass(input: { now?: Date; skillsDir?: string } = {}) {
    const db = getDb();
    const now = input.now ?? new Date();
    const skillsDir = input.skillsDir ?? testingSkillsDir ?? agentEngineSkillsDir;
    const model = resolveModelCategorySelection('deep');
    const agentId = ensurePrimaryManagedAgent(db).id;
    const transitions = await applySkillLifecycleTransitions({ db, now, skillsDir });
    const promptData = await buildCuratorPromptData({ db, skillsDir });

    const jobId = createCuratorJob({ agentId, db, model, now });
    if (promptData.activeAgentSkillCount < 2) {
        const reason = 'fewer than 2 active agent-created skills';
        skipCuratorJob(db, jobId, { now, reason, transitions });
        writeRuntimeMetadata(skillCuratorMetadataKey, now.toISOString(), db);
        return { jobId, skipped: true };
    }

    try {
        const outcome = await modelWorker({ agentId, jobId });
        completeCuratorJob(db, jobId, { now, outcome, transitions });
        writeRuntimeMetadata(skillCuratorMetadataKey, now.toISOString(), db);
        return { jobId, skipped: false };
    } catch (error) {
        failCuratorJob(db, jobId, error, now);
        throw error;
    }
}

export async function runAiSdkSkillCurator(input: SkillCuratorInput): Promise<SkillCuratorOutcome> {
    const model = resolveModelCategorySelection('deep');
    const skillsDir = testingSkillsDir ?? agentEngineSkillsDir;
    const result = await generateText({
        model: await createLanguageModelForRuntime(model),
        prompt: JSON.stringify(await buildCuratorPromptData({ skillsDir }), null, 2),
        stopWhen: stepCountIs(24),
        system: skillCuratorInstructions,
        tools: wrapSkillTools(createCuratorSkillTools({ agentId: input.agentId, skillsDir })),
    });
    const transcript = serializeCuratorTranscript(result);
    return {
        actions: collectCuratorActions(transcript),
        model,
        report: {
            text: result.text.trim(),
            toolErrors: collectSkillReviewToolErrors(transcript),
        },
        transcript,
        usage: result.usage ?? {},
    };
}

async function processSkillCuratorOnce(input: { now?: Date }) {
    const model = resolveModelCategorySelection('deep');
    if (!supportsLanguageModelForRuntime(model)) {
        return { completed: 0, skipped: 1 };
    }
    const gate = shouldRunSkillCurator(input);
    if (!gate.ok) {
        return { completed: 0, skipped: 1 };
    }
    const result = await runSkillCuratorPass(input);
    return result.skipped ? { completed: 0, skipped: 1 } : { completed: 1, skipped: 0 };
}

async function buildCuratorPromptData(input: { db?: Database; skillsDir: string }) {
    const db = input.db ?? getDb();
    const installed = await listRuntimeSkills({
        includePluginSkills: false,
        skillsDir: input.skillsDir,
    });
    const candidates: CuratorCandidate[] = [];
    const readOnlySkillIds: string[] = [];
    for (const skill of installed) {
        const source = skill.id === 'tavern-agent' ? 'seeded' : resolveSkillSource(skill.id, db);
        if (source !== 'agent') {
            readOnlySkillIds.push(skill.id);
            continue;
        }
        const row = readSkillLifecycleRow(skill.id, db);
        if (row?.state === 'archived') {
            continue;
        }
        const usage = readSkillUsageSummary(skill.id, db);
        candidates.push({
            description: skill.description,
            id: skill.id,
            lastUsedAt: usage.lastUsedAt,
            name: skill.name,
            state: row?.state ?? 'active',
            useCount: usage.useCount,
        });
    }

    return {
        activeAgentSkillCount: candidates.filter((skill) => skill.state === 'active').length,
        candidates: candidates.sort((left, right) => left.id.localeCompare(right.id)),
        readOnlySkillIds: readOnlySkillIds.sort(),
    };
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
                            return { ok: true, output: await entry.execute?.(toolInput, options) };
                        } catch (error) {
                            return { error: formatError(error), ok: false };
                        }
                    },
                },
            ];
        })
    ) as ToolSet;
}

function readSkillLifecycleRow(skillId: string, db: Database) {
    return db
        .prepare('SELECT state FROM skill_sources WHERE skill_id = $skillId')
        .get(namedParams({ skillId })) as { state: string } | null;
}

function formatError(error: unknown) {
    return error instanceof Error ? error.message : String(error);
}

export function skillCuratorModelRef(model: AgentRuntimeModelName) {
    return modelCategoryModelRef(model);
}
