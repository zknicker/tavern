import { describe, expect, test } from 'bun:test';
import type { CronListItem } from './cron-list-data.ts';
import { filterCronJobs } from './filter-cron-jobs.ts';

function createCronJob(
    input: Pick<CronListItem, 'description' | 'enabled' | 'id' | 'name' | 'schedule'>
): CronListItem {
    return {
        description: input.description,
        enabled: input.enabled,
        id: input.id,
        name: input.name,
        schedule: input.schedule,
    } as unknown as CronListItem;
}

const cronJobs: CronListItem[] = [
    createCronJob({
        id: '1',
        name: 'Daily ingest',
        description: 'Pull metrics from the gateway',
        enabled: true,
        schedule: '0 0 * * *',
    }),
    createCronJob({
        id: '2',
        name: 'Paused cleanup',
        description: 'Remove stale temp files',
        enabled: false,
        schedule: '0 12 * * *',
    }),
];

describe('filterCronJobs', () => {
    test('returns all jobs when no filters are applied', () => {
        expect(
            filterCronJobs({
                cronJobs: [...cronJobs],
                filter: 'all',
                query: '',
            })
        ).toHaveLength(2);
    });

    test('filters to enabled jobs', () => {
        expect(
            filterCronJobs({
                cronJobs: [...cronJobs],
                filter: 'active',
                query: '',
            }).map((job) => job.id)
        ).toEqual(['1']);
    });

    test('filters to paused jobs', () => {
        expect(
            filterCronJobs({
                cronJobs: [...cronJobs],
                filter: 'paused',
                query: '',
            }).map((job) => job.id)
        ).toEqual(['2']);
    });

    test('matches the normalized query across searchable fields', () => {
        expect(
            filterCronJobs({
                cronJobs: [...cronJobs],
                filter: 'all',
                query: 'gateway',
            }).map((job) => job.id)
        ).toEqual(['1']);
    });
});
