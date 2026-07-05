import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { generateText } from 'ai';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { seedTavernAgentSkill, tavernAgentSkillId } from '../agent-engine/skill-library.ts';
import { closeDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import { processDueSkillReviews, resetSkillReviewSchedulerForTesting } from './review-queue.ts';
import {
    configureStandardReviewModel,
    dueAt,
    insertReviewWindowMessages,
    type ModelToolCall,
    modelResult,
    queueReview,
    readReviewQueue,
    readSkillReviewJobs,
    runModelTool,
    seedReviewAgentChat,
    unwrapToolOutput,
} from './review-test-helpers.ts';
import {
    resetSkillReviewWorkerForTesting,
    setSkillReviewModelWorkerForTesting,
    setSkillReviewSkillsDirForTesting,
} from './review-worker.ts';
import { createAgentSkill } from './store.ts';

vi.mock('ai', () => ({
    generateText: vi.fn(),
    stepCountIs: (count: number) => ({ count }),
    tool: <T>(definition: T) => definition,
}));

const generateTextMock = vi.mocked(generateText);

describe('skill review worker', () => {
    let workspace: string;
    let skillsDir: string;

    beforeEach(async () => {
        workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-review-workspace-'));
        skillsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-review-skills-'));
        ensureRuntimeSchema(initTestDb());
        configureStandardReviewModel();
        seedReviewAgentChat({ enabledSkillIds: [], workspace });
        setSkillReviewSkillsDirForTesting(skillsDir);
    });

    afterEach(async () => {
        resetSkillReviewSchedulerForTesting();
        resetSkillReviewWorkerForTesting();
        vi.restoreAllMocks();
        closeDb();
        await fs.rm(workspace, { force: true, recursive: true });
        await fs.rm(skillsDir, { force: true, recursive: true });
    });

    test('patches an agent-created skill and records actions', async () => {
        await createAgentSkill({
            agentId: 'agt_primary',
            content: '# Code Review\n\nCheck the diff.',
            description: 'Code review',
            name: 'Code Review',
            skillsDir,
        });
        insertReviewWindowMessages();
        queueReview({
            endSequence: 2,
            signals: [
                {
                    detail: 'Run runtime tests before lint when reviewing Runtime patches.',
                    kind: 'technique',
                },
            ],
            startSequence: 1,
        });
        generateTextMock.mockImplementationOnce(async (config) => {
            const calls: ModelToolCall[] = [];
            const view = await runModelTool(config, calls, 'skill_view', {
                skillId: 'code-review',
            });
            const viewed = unwrapToolOutput(view) as {
                content: string;
                hash: string;
            };
            await runModelTool(config, calls, 'skill_patch', {
                content: `${viewed.content}\n\nAlways run Runtime tests before lint on Runtime patches.`,
                expectedHash: viewed.hash,
                skillId: 'code-review',
            });
            return modelResult({
                calls,
                text: '- Patched code-review.',
            });
        });

        await expect(processDueSkillReviews({ now: dueAt() })).resolves.toEqual({
            completed: 1,
            failed: 0,
            skipped: 0,
        });

        await expect(
            fs.readFile(path.join(skillsDir, 'code-review', 'SKILL.md'), 'utf8')
        ).resolves.toContain('Always run Runtime tests before lint');
        expect(readReviewQueue()).toBeNull();
        const [job] = readSkillReviewJobs();
        expect(job).toMatchObject({
            kind: 'skill_review',
            model_category: 'standard',
            source_end_sequence: 2,
            source_start_sequence: 1,
            status: 'completed',
        });
        expect(JSON.parse(job?.metadata_json ?? '{}')).toMatchObject({
            actions: [
                {
                    path: 'SKILL.md',
                    skillId: 'code-review',
                    tool: 'skill_patch',
                },
            ],
            report: { text: '- Patched code-review.' },
        });
    });

    test('records write-guard errors from seeded skills and still completes', async () => {
        await seedTavernAgentSkill({ skillsDir });
        seedReviewAgentChat({ enabledSkillIds: [tavernAgentSkillId], workspace });
        insertReviewWindowMessages();
        queueReview({
            endSequence: 2,
            signals: [
                {
                    detail: 'Seeded skill missed an update.',
                    kind: 'skill_misfire',
                    skillId: tavernAgentSkillId,
                },
            ],
            startSequence: 1,
        });
        generateTextMock.mockImplementationOnce(async (config) => {
            const calls: ModelToolCall[] = [];
            const view = await runModelTool(config, calls, 'skill_view', {
                skillId: tavernAgentSkillId,
            });
            const viewed = unwrapToolOutput(view) as {
                content: string;
                hash: string;
            };
            await runModelTool(config, calls, 'skill_patch', {
                content: `${viewed.content}\n\nPatch seeded skill.`,
                expectedHash: viewed.hash,
                skillId: tavernAgentSkillId,
            });
            return modelResult({
                calls,
                text: 'Seeded skill is read-only; no durable change.',
            });
        });

        await expect(processDueSkillReviews({ now: dueAt() })).resolves.toEqual({
            completed: 1,
            failed: 0,
            skipped: 0,
        });

        await expect(
            fs.readFile(path.join(skillsDir, tavernAgentSkillId, 'SKILL.md'), 'utf8')
        ).resolves.not.toContain('Patch seeded skill');
        const [job] = readSkillReviewJobs();
        expect(JSON.parse(job?.metadata_json ?? '{}')).toMatchObject({
            actions: [],
            report: {
                toolErrors: [
                    {
                        error: expect.stringContaining('read-only'),
                        tool: 'skill_patch',
                    },
                ],
            },
        });
    });

    test('completes without actions when there is nothing to change', async () => {
        insertReviewWindowMessages();
        queueReview({
            endSequence: 2,
            signals: [{ detail: 'Too weak to persist.', kind: 'frustration' }],
            startSequence: 1,
        });
        generateTextMock.mockResolvedValueOnce(
            modelResult({
                calls: [],
                text: 'Nothing to change.',
            })
        );

        await expect(processDueSkillReviews({ now: dueAt() })).resolves.toEqual({
            completed: 1,
            failed: 0,
            skipped: 0,
        });

        const [job] = readSkillReviewJobs();
        expect(JSON.parse(job?.metadata_json ?? '{}')).toMatchObject({
            actions: [],
            report: { text: 'Nothing to change.' },
        });
    });

    test('fails jobs and retries queue rows until the attempt cap', async () => {
        insertReviewWindowMessages();
        queueReview({
            endSequence: 2,
            signals: [{ detail: 'Retry this worker.', kind: 'technique' }],
            startSequence: 1,
        });
        setSkillReviewModelWorkerForTesting(async () => {
            throw new Error('model down');
        });

        for (const now of [
            dueAt(),
            new Date('2026-07-02T20:16:00.000Z'),
            new Date('2026-07-02T20:31:00.000Z'),
        ]) {
            await expect(processDueSkillReviews({ now })).resolves.toEqual({
                completed: 0,
                failed: 1,
                skipped: 0,
            });
        }

        expect(readReviewQueue()).toBeNull();
        expect(readSkillReviewJobs()).toMatchObject([
            { error: 'model down', status: 'failed' },
            { error: 'model down', status: 'failed' },
            { error: 'model down', status: 'failed' },
        ]);
    });
});
