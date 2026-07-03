import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { closeDb, getDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import { namedParams } from '../db/sqlite.ts';
import {
    maybeQueueMemoryDreamForAgent,
    processQueuedMemoryDreams,
    queueMemoryDream,
    recoverInterruptedMemoryJobs,
    resetMemoryDreamSchedulerForTesting,
} from './dreaming.ts';
import { handleMemoryRequest } from './routes.ts';
import { MemoryDreamWorkerError } from './worker.ts';

describe('Memory dreaming', () => {
    beforeEach(() => {
        ensureRuntimeSchema(initTestDb());
    });

    afterEach(() => {
        resetMemoryDreamSchedulerForTesting();
        closeDb();
    });

    test('queues a first dream after a completed extraction', () => {
        insertCompletedExtraction('memjob_extract_1', '2026-07-02T20:00:00.000Z');

        const jobId = maybeQueueMemoryDreamForAgent({
            agentId: 'agt_primary',
            now: new Date('2026-07-02T20:00:00.000Z'),
        });

        expect(jobId).toMatch(/^memdream_/u);
        expect(readJobs()).toMatchObject([
            { id: 'memjob_extract_1', kind: 'extraction', status: 'completed' },
            {
                agent_id: 'agt_primary',
                kind: 'dream',
                model_category: 'standard',
                status: 'queued',
            },
        ]);
    });

    test('waits for five completed extractions after the latest completed dream', () => {
        insertCompletedDream('memdream_previous', '2026-07-02T20:00:00.000Z');
        for (let index = 0; index < 4; index += 1) {
            insertCompletedExtraction(
                `memjob_extract_${index}`,
                `2026-07-02T20:0${index + 1}:00.000Z`
            );
        }

        expect(
            maybeQueueMemoryDreamForAgent({
                agentId: 'agt_primary',
                now: new Date('2026-07-02T21:00:00.000Z'),
            })
        ).toBeNull();

        insertCompletedExtraction('memjob_extract_5', '2026-07-02T20:06:00.000Z');
        expect(
            maybeQueueMemoryDreamForAgent({
                agentId: 'agt_primary',
                now: new Date('2026-07-02T21:00:00.000Z'),
            })
        ).toMatch(/^memdream_/u);
    });

    test('sweep queues quiet agents once the age threshold passes', async () => {
        insertCompletedDream('memdream_previous', '2026-07-01T20:00:00.000Z');
        insertCompletedExtraction('memjob_extract_1', '2026-07-01T20:05:00.000Z');

        await expect(
            processQueuedMemoryDreams({
                now: new Date('2026-07-02T20:01:00.000Z'),
                worker: async () => ({
                    fileChanges: [],
                    model: { model: 'gpt-4.1', provider: 'openai' },
                    text: 'No changes.',
                    transcript: { text: 'No changes.' },
                    usage: {},
                }),
            })
        ).resolves.toEqual({ completed: 1, failed: 0, skipped: 0 });

        expect(readJobs().filter((job) => job.kind === 'dream')).toHaveLength(2);
    });

    test('completes queued dreams with worker output and transcript evidence', async () => {
        const jobId = queueMemoryDream({ agentId: 'agt_primary', explicit: true });

        await expect(
            processQueuedMemoryDreams({
                worker: async () => ({
                    fileChanges: [
                        {
                            afterHash: 'after',
                            beforeHash: 'before',
                            path: 'Projects/Alpha.md',
                        },
                    ],
                    model: { model: 'gpt-4.1', provider: 'openai' },
                    text: 'Updated Alpha.',
                    transcript: { text: 'Updated Alpha.', toolCalls: [] },
                    usage: { totalTokens: 12 },
                }),
            })
        ).resolves.toEqual({ completed: 1, failed: 0, skipped: 0 });

        expect(readJob(jobId)).toMatchObject({
            file_changes_json:
                '[{"afterHash":"after","beforeHash":"before","path":"Projects/Alpha.md"}]',
            metadata_json: '{"summary":"Updated Alpha."}',
            output_path: 'Projects/Alpha.md',
            status: 'completed',
            transcript_json: '{"text":"Updated Alpha.","toolCalls":[]}',
            usage_json: '{"totalTokens":12}',
        });
    });

    test('recovers interrupted running jobs so future dreams can queue', () => {
        insertMemoryJob({
            createdAt: '2026-07-02T20:00:00.000Z',
            id: 'memdream_running',
            kind: 'dream',
            metadataJson: '{}',
            modelCategory: 'standard',
            status: 'running',
        });

        expect(
            queueMemoryDream({
                agentId: 'agt_primary',
                explicit: true,
                now: new Date('2026-07-02T20:01:00.000Z'),
            })
        ).toBe('memdream_running');
        expect(recoverInterruptedMemoryJobs()).toBe(1);
        expect(readJob('memdream_running')).toMatchObject({
            error: 'Memory job interrupted by Runtime shutdown.',
            status: 'failed',
        });
        expect(
            queueMemoryDream({
                agentId: 'agt_primary',
                explicit: true,
                now: new Date('2026-07-02T20:02:00.000Z'),
            })
        ).toMatch(/^memdream_/u);
    });

    test('failed dreams keep partial file-change audit trail', async () => {
        const jobId = queueMemoryDream({ agentId: 'agt_primary', explicit: true });
        const partialChanges = [
            {
                afterHash: 'after',
                beforeHash: 'before',
                path: 'Projects/Partial.md',
            },
        ];

        await expect(
            processQueuedMemoryDreams({
                worker: async () => {
                    throw new MemoryDreamWorkerError(new Error('model stopped'), partialChanges);
                },
            })
        ).resolves.toEqual({ completed: 0, failed: 1, skipped: 0 });

        expect(readJob(jobId)).toMatchObject({
            error: 'model stopped',
            file_changes_json:
                '[{"afterHash":"after","beforeHash":"before","path":"Projects/Partial.md"}]',
            status: 'failed',
        });
    });

    test('recent failed dreams back off automatic requeue', async () => {
        insertCompletedExtraction('memjob_extract_1', '2026-07-02T20:00:00.000Z');
        insertMemoryJob({
            createdAt: '2026-07-02T20:01:00.000Z',
            id: 'memdream_failed',
            kind: 'dream',
            metadataJson: '{}',
            modelCategory: 'standard',
            status: 'failed',
        });

        await expect(
            processQueuedMemoryDreams({
                now: new Date('2026-07-02T20:30:00.000Z'),
                worker: async () => {
                    throw new Error('should not run');
                },
            })
        ).resolves.toEqual({ completed: 0, failed: 0, skipped: 0 });

        expect(readJobs().filter((job) => job.kind === 'dream')).toHaveLength(1);
    });

    test('lists and reads Memory jobs through the Runtime route', async () => {
        insertCompletedExtraction('memjob_extract_1', '2026-07-02T20:00:00.000Z');

        const listResponse = await handleMemoryRequest(
            new Request('http://runtime.test/memory/jobs?agentId=agt_primary')
        );
        expect(listResponse?.status).toBe(200);
        await expect(listResponse?.json()).resolves.toMatchObject({
            jobs: [{ id: 'memjob_extract_1', kind: 'extraction', status: 'completed' }],
        });

        const detailResponse = await handleMemoryRequest(
            new Request('http://runtime.test/memory/jobs/memjob_extract_1')
        );
        expect(detailResponse?.status).toBe(200);
        await expect(detailResponse?.json()).resolves.toMatchObject({
            fileChanges: [],
            id: 'memjob_extract_1',
            metadata: { extractionMode: 'transcript-excerpt' },
        });
    });
});

function insertCompletedExtraction(id: string, createdAt: string) {
    insertMemoryJob({
        createdAt,
        id,
        kind: 'extraction',
        metadataJson: JSON.stringify({ extractionMode: 'transcript-excerpt' }),
        modelCategory: null,
        status: 'completed',
    });
}

function insertCompletedDream(id: string, createdAt: string) {
    insertMemoryJob({
        createdAt,
        id,
        kind: 'dream',
        metadataJson: JSON.stringify({ summary: 'Previous dream.' }),
        modelCategory: 'standard',
        status: 'completed',
    });
}

function insertMemoryJob(input: {
    createdAt: string;
    id: string;
    kind: 'dream' | 'extraction';
    metadataJson: string;
    modelCategory: 'standard' | null;
    status: 'completed' | 'failed' | 'queued' | 'running';
}) {
    getDb()
        .prepare(
            `INSERT INTO memory_jobs (
                id, kind, status, agent_id, model_category, file_changes_json,
                metadata_json, created_at, updated_at, started_at, completed_at
             )
             VALUES (
                $id, $kind, $status, 'agt_primary', $modelCategory, '[]',
                $metadataJson, $createdAt, $createdAt, $createdAt, $createdAt
             )`
        )
        .run(
            namedParams({
                createdAt: input.createdAt,
                id: input.id,
                kind: input.kind,
                metadataJson: input.metadataJson,
                modelCategory: input.modelCategory,
                status: input.status,
            })
        );
}

function readJobs() {
    return getDb().prepare('SELECT * FROM memory_jobs ORDER BY created_at ASC').all() as Array<{
        agent_id: string;
        id: string;
        kind: string;
        model_category: string | null;
        status: string;
    }>;
}

function readJob(id: string) {
    return getDb().prepare('SELECT * FROM memory_jobs WHERE id = $id').get(namedParams({ id }));
}
