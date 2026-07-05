import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { closeDb, getDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import { namedParams } from '../db/sqlite.ts';
import { skillCuratorMetadataKey } from '../skills/curator-store.ts';
import { handleMemoryRequest } from './routes.ts';

describe('Memory routes', () => {
    beforeEach(() => {
        ensureRuntimeSchema(initTestDb());
    });

    afterEach(() => {
        vi.useRealTimers();
        closeDb();
    });

    test('filters Memory jobs by kind, status, and recent window', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-07-05T12:00:00.000Z'));
        insertMemoryJob({
            createdAt: '2026-07-03T12:00:00.000Z',
            id: 'memjob_extract_recent',
            kind: 'extraction',
            modelCategory: 'fast',
            status: 'completed',
        });
        insertMemoryJob({
            createdAt: '2026-07-04T12:00:00.000Z',
            id: 'memjob_review_recent',
            kind: 'skill_review',
            modelCategory: 'standard',
            status: 'failed',
        });
        insertMemoryJob({
            createdAt: '2026-06-25T12:00:00.000Z',
            id: 'memdream_old',
            kind: 'dream',
            modelCategory: 'standard',
            status: 'queued',
        });
        insertMemoryJob({
            createdAt: '2026-07-04T13:00:00.000Z',
            id: 'memcuration_recent',
            kind: 'curation',
            modelCategory: 'deep',
            status: 'completed',
        });

        const response = await handleMemoryRequest(
            new Request(
                'http://runtime.test/memory/jobs?kind=extraction,skill_review&status=completed,failed&sinceDays=3'
            )
        );

        expect(response?.status).toBe(200);
        await expect(response?.json()).resolves.toMatchObject({
            jobs: [
                { id: 'memjob_review_recent', kind: 'skill_review', status: 'failed' },
                { id: 'memjob_extract_recent', kind: 'extraction', status: 'completed' },
            ],
        });
    });

    test('lists Memory workers with scheduled next runs and latest run summaries', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-07-02T20:00:00.000Z'));
        saveModelCategories('openai');
        insertChat('chat_memory');
        insertMemoryJob({
            completedAt: '2026-07-02T20:00:03.000Z',
            createdAt: '2026-07-02T20:00:00.000Z',
            id: 'memjob_extract_1',
            kind: 'extraction',
            modelCategory: 'fast',
            startedAt: '2026-07-02T20:00:00.000Z',
            status: 'completed',
        });
        insertMemoryJob({
            createdAt: '2026-07-02T20:01:00.000Z',
            id: 'memdream_queued',
            kind: 'dream',
            modelCategory: 'standard',
            status: 'queued',
        });
        insertDebounce('2026-07-02T20:05:00.000Z');
        insertSkillReviewQueue('2026-07-02T20:06:00.000Z');
        writeMetadata(skillCuratorMetadataKey, '2026-07-01T20:00:00.000Z');

        const response = await handleMemoryRequest(
            new Request('http://runtime.test/memory/workers')
        );

        expect(response?.status).toBe(200);
        await expect(response?.json()).resolves.toMatchObject({
            workers: [
                {
                    enabled: true,
                    kind: 'extraction',
                    lastRun: { durationMs: 3000, id: 'memjob_extract_1' },
                    nextRun: { at: '2026-07-02T20:05:00.000Z', kind: 'scheduled' },
                },
                {
                    enabled: true,
                    kind: 'dream',
                    lastRun: null,
                    nextRun: { at: '2026-07-02T20:01:00.000Z', kind: 'scheduled' },
                },
                {
                    enabled: true,
                    kind: 'skill_review',
                    nextRun: { at: '2026-07-02T20:06:00.000Z', kind: 'scheduled' },
                },
                {
                    enabled: true,
                    kind: 'curation',
                    nextRun: { at: '2026-07-08T20:00:00.000Z', kind: 'scheduled' },
                },
            ],
        });
    });

    test('lists waiting branches and never-run curation first cadence', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-07-05T20:00:00.000Z'));
        saveModelCategories('openai');

        const response = await handleMemoryRequest(
            new Request('http://runtime.test/memory/workers')
        );
        expect(response?.status).toBe(200);
        await expect(response?.json()).resolves.toMatchObject({
            workers: [
                { kind: 'extraction', nextRun: { kind: 'waiting', waitingOn: 'chat activity' } },
                {
                    kind: 'dream',
                    nextRun: { kind: 'waiting', waitingOn: 'new episodic evidence' },
                },
                {
                    kind: 'skill_review',
                    nextRun: { kind: 'waiting', waitingOn: 'learning signals' },
                },
                {
                    kind: 'curation',
                    nextRun: { at: '2026-07-12T20:00:00.000Z', kind: 'scheduled' },
                },
            ],
        });
    });

    test('lists due curation as waiting on runtime idle when gated', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-07-05T20:00:00.000Z'));
        saveModelCategories('openai');
        insertChat('chat_memory');
        insertSkillReviewQueue('2026-07-05T20:06:00.000Z');
        writeMetadata(skillCuratorMetadataKey, '2026-06-20T20:00:00.000Z');

        const response = await handleMemoryRequest(
            new Request('http://runtime.test/memory/workers')
        );

        expect(response?.status).toBe(200);
        await expect(response?.json()).resolves.toMatchObject({
            workers: [
                {},
                {},
                {},
                { kind: 'curation', nextRun: { kind: 'waiting', waitingOn: 'runtime idle' } },
            ],
        });
    });

    test('disables worker rows when configured categories lack a LanguageModel adapter', async () => {
        saveModelCategories('claude');
        insertChat('chat_memory');
        insertDebounce('2026-07-02T20:05:00.000Z');
        insertMemoryJob({
            createdAt: '2026-07-02T20:01:00.000Z',
            id: 'memdream_queued',
            kind: 'dream',
            modelCategory: 'standard',
            status: 'queued',
        });
        insertSkillReviewQueue('2026-07-02T20:06:00.000Z');

        const response = await handleMemoryRequest(
            new Request('http://runtime.test/memory/workers')
        );

        expect(response?.status).toBe(200);
        await expect(response?.json()).resolves.toMatchObject({
            workers: [
                { enabled: false, kind: 'extraction', nextRun: null },
                { enabled: false, kind: 'dream', nextRun: null },
                { enabled: false, kind: 'skill_review', nextRun: null },
                { enabled: false, kind: 'curation', nextRun: null },
            ],
        });
    });
});

function saveModelCategories(provider: 'claude' | 'openai') {
    const openai = provider === 'openai';
    writeMetadata(
        'models:category-settings',
        JSON.stringify({
            categories: {
                deep: { model: openai ? 'gpt-4.1' : 'claude-sonnet-4', provider },
                fast: { model: openai ? 'gpt-4.1-mini' : 'claude-haiku-4', provider },
                standard: { model: openai ? 'gpt-4.1-mini' : 'claude-sonnet-4', provider },
                visual: null,
            },
        })
    );
}

function insertMemoryJob(input: {
    completedAt?: string | null;
    createdAt: string;
    id: string;
    kind: 'curation' | 'dream' | 'extraction' | 'skill_review';
    modelCategory: 'deep' | 'fast' | 'standard' | null;
    startedAt?: string | null;
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
                '{}', $createdAt, $createdAt, $startedAt, $completedAt
             )`
        )
        .run(
            namedParams({
                completedAt:
                    input.completedAt ?? (input.status === 'queued' ? null : input.createdAt),
                createdAt: input.createdAt,
                id: input.id,
                kind: input.kind,
                modelCategory: input.modelCategory,
                startedAt: input.startedAt ?? (input.status === 'queued' ? null : input.createdAt),
                status: input.status,
            })
        );
}
function insertChat(chatId: string) {
    getDb()
        .prepare(
            `INSERT INTO chats (id, kind, title, metadata_json, created_at, updated_at)
             VALUES ($chatId, 'channel', 'Memory chat', '{}', $now, $now)`
        )
        .run(namedParams({ chatId, now: '2026-07-02T20:00:00.000Z' }));
}

function insertDebounce(scheduledFor: string) {
    getDb()
        .prepare(
            `INSERT INTO memory_extraction_debounces (
                chat_id, agent_participant_id, agent_id, pending_since,
                last_activity_at, scheduled_for, target_sequence, attempts, updated_at
             )
             VALUES (
                'chat_memory', 'participant_agent', 'agt_primary', $now,
                $now, $scheduledFor, 1, 0, $now
             )`
        )
        .run(namedParams({ now: '2026-07-02T20:00:00.000Z', scheduledFor }));
}

function insertSkillReviewQueue(scheduledFor: string) {
    getDb()
        .prepare(
            `INSERT INTO skill_review_queue (
                agent_id, chat_id, signals_json, window_start_sequence,
                window_end_sequence, attempts, scheduled_for, created_at, updated_at
             )
             VALUES (
                'agt_primary', 'chat_memory', '[]', 1, 2, 0,
                $scheduledFor, $now, $now
             )`
        )
        .run(namedParams({ now: '2026-07-02T20:00:00.000Z', scheduledFor }));
}

function writeMetadata(key: string, value: string) {
    getDb()
        .prepare(
            `INSERT INTO runtime_metadata (key, value, updated_at)
             VALUES ($key, $value, $now)
             ON CONFLICT(key) DO UPDATE SET
               value = excluded.value,
               updated_at = excluded.updated_at`
        )
        .run(namedParams({ key, now: '2026-07-02T20:00:00.000Z', value }));
}
