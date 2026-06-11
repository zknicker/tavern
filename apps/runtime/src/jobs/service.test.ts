import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { closeDb, initTestDb } from '../db/connection';
import { ensureRuntimeSchema } from '../db/schema';
import { ensureRuntimeJobsSchema } from './schema';
import { listRuntimeJobs } from './service';

describe('Runtime jobs service', () => {
    beforeEach(() => {
        const db = initTestDb();
        ensureRuntimeSchema(db);
        ensureRuntimeJobsSchema(db);
    });

    afterEach(() => {
        closeDb();
    });

    test('exposes only Runtime-owned operational jobs', async () => {
        const { jobs } = await listRuntimeJobs();

        expect(jobs.map((job) => job.slug)).toEqual([
            'refresh-runtime-capabilities',
            'sync-managed-crons',
            'tavern-highlights',
            'wiki-health-history',
        ]);
        expect(jobs.some((job) => job.slug.startsWith('cortex-'))).toBe(false);
    });
});
