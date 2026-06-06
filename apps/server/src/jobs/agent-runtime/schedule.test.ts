import { afterEach, mock, spyOn, test } from 'bun:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import type { RegisteredJobDefinition } from '../../../../../jobs/index.ts';
import { syncScheduledJob } from './schedule.ts';
import type { QueueBinding } from './shared.ts';

afterEach(() => {
    mock.restore();
});

test('syncScheduledJob treats enablement check failures as disabled jobs', async () => {
    const removedRuns: string[] = [];
    let schedulerRemoved = false;
    let schedulerUpserted = false;
    let jobAdded = false;
    spyOn(console, 'warn').mockImplementation(() => {});

    const binding = {
        definition: {
            concurrency: 1,
            defaultInput: {},
            description: 'Sync OpenRouter usage',
            displayName: 'Sync OpenRouter Usage',
            isEnabled: async () => {
                throw new Error('Runtime request failed with status 502.');
            },
            payloadSchema: z.object({}),
            run: async () => {},
            schedule: {
                everyMs: 300_000,
                kind: 'interval',
                runOnStart: true,
            },
            slug: 'sync-openrouter-usage',
        } satisfies RegisteredJobDefinition,
        queue: {
            async add() {
                jobAdded = true;
            },
            async getDelayedAsync() {
                return [];
            },
            async getJobCountsAsync() {
                return {
                    delayed: 0,
                    waiting: 1,
                };
            },
            async getJobScheduler() {
                return {
                    key: 'sync-openrouter-usage',
                };
            },
            async getWaitingAsync() {
                return [
                    {
                        id: 'pending-run',
                    },
                ];
            },
            async remove(jobId: string) {
                removedRuns.push(jobId);
            },
            async removeJobScheduler() {
                schedulerRemoved = true;
            },
            async upsertJobScheduler() {
                schedulerUpserted = true;
            },
        },
        worker: {},
    } as unknown as QueueBinding;

    await syncScheduledJob(binding);

    assert.equal(schedulerRemoved, true);
    assert.equal(schedulerUpserted, false);
    assert.equal(jobAdded, false);
    assert.deepEqual(removedRuns, ['pending-run']);
});
