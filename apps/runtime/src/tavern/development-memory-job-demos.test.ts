import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { closeDb, getDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import { maybeQueueMemoryDreamForAgent } from '../memory/dreaming.ts';
import { createChat } from './chat-api/index.ts';
import { seedDevelopmentMemoryJobDemos } from './development-memory-job-demos.ts';

const now = new Date('2026-07-03T18:00:00.000Z');

describe('Development Memory job demos', () => {
    let workspace: string;

    beforeEach(async () => {
        workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-memory-demo-seed-'));
        ensureRuntimeSchema(initTestDb());
        createChat({ id: 'cht_demo', title: 'demo' });
    });

    afterEach(async () => {
        closeDb();
        await fs.rm(workspace, { force: true, recursive: true });
    });

    test('seeds capture and dream history with episodic backing files, idempotently', async () => {
        const first = await seedDevelopmentMemoryJobDemos({
            db: getDb(),
            enabled: true,
            now,
            workspaceDir: workspace,
        });
        expect(first.seeded).toBe(6);

        const again = await seedDevelopmentMemoryJobDemos({
            db: getDb(),
            enabled: true,
            now,
            workspaceDir: workspace,
        });
        expect(again.seeded).toBe(6);

        const jobs = getDb()
            .prepare('SELECT id, kind, status, chat_id FROM memory_jobs ORDER BY created_at ASC')
            .all() as Array<{ chat_id: string | null; id: string; kind: string; status: string }>;
        expect(jobs).toHaveLength(6);
        expect(jobs.filter((job) => job.kind === 'extraction')).toHaveLength(4);
        expect(jobs.filter((job) => job.kind === 'dream')).toHaveLength(2);
        expect(new Set(jobs.map((job) => job.status))).toEqual(
            new Set(['completed', 'failed', 'skipped'])
        );
        expect(
            jobs
                .filter((job) => job.kind === 'extraction')
                .every((job) => job.chat_id === 'cht_demo')
        ).toBe(true);

        const episodicFiles = await fs.readdir(path.join(workspace, '.memory', 'episodic'));
        expect(episodicFiles.length).toBeGreaterThan(0);
        const contents = await Promise.all(
            episodicFiles.map((file) =>
                fs.readFile(path.join(workspace, '.memory', 'episodic', file), 'utf8')
            )
        );
        const combined = contents.join('\n');
        expect(combined).toContain('memjob_demo_capture_early');
        expect(combined).toContain('memjob_demo_capture_recent');
        // Idempotent: one entry per job even after re-seeding.
        expect(combined.match(/memjob_demo_capture_early/gu)).toHaveLength(1);

        await expect(fs.readFile(path.join(workspace, 'USER.md'), 'utf8')).resolves.toContain(
            'line charts'
        );
    });

    test('seeded history never makes an automatic dream eligible', async () => {
        await seedDevelopmentMemoryJobDemos({
            db: getDb(),
            enabled: true,
            now,
            workspaceDir: workspace,
        });

        expect(maybeQueueMemoryDreamForAgent({ agentId: 'agt_primary', now })).toBeNull();
        expect(
            getDb()
                .prepare(
                    `SELECT COUNT(*) AS count FROM memory_jobs WHERE status IN ('queued', 'running')`
                )
                .get() as { count: number }
        ).toMatchObject({ count: 0 });
    });

    test('does nothing outside the dev stack', async () => {
        const result = await seedDevelopmentMemoryJobDemos({
            db: getDb(),
            enabled: false,
            now,
            workspaceDir: workspace,
        });
        expect(result.seeded).toBe(0);
        expect(
            getDb().prepare('SELECT COUNT(*) AS count FROM memory_jobs').get() as { count: number }
        ).toMatchObject({ count: 0 });
    });
});
