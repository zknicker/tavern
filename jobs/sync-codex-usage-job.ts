import { type ZodType, z } from 'zod';
import { emitUsageLiveUpdated } from '../apps/server/src/api/invalidation-events.ts';
import {
    deleteCodexUsageSnapshot,
    getCodexUsageSnapshot,
    saveCodexUsageSnapshot,
} from '../apps/server/src/storage/provider-usage.ts';
import { CodexUsageAuthError, getCodexUsage } from '../packages/codex-usage/src/index.ts';
import { defineJob } from './define-job.ts';
import { getCodexUsageSoftFailureMessage } from './provider-usage-soft-failures.ts';

const emptyInputSchema = z.object({}).strict() as ZodType<Record<string, unknown>>;
const providerUsageJobIntervalMs = 5 * 60 * 1000;

export const syncCodexUsageJob = defineJob('sync-codex-usage')
    .displayName('Sync Codex Usage')
    .description('Reads Codex usage and stores the latest snapshot for the dashboard.')
    .input(emptyInputSchema)
    .defaultInput({})
    .interval({
        everyMs: providerUsageJobIntervalMs,
        runOnStart: true,
    })
    .work(async ({ fail, log }) => {
        try {
            const snapshot = await getCodexUsage();

            await saveCodexUsageSnapshot(snapshot);
            await log(`Stored Codex usage snapshot from ${snapshot.capturedAt}.`);
            emitUsageLiveUpdated();
        } catch (error) {
            if (error instanceof CodexUsageAuthError) {
                const existingSnapshot = await getCodexUsageSnapshot();

                if (existingSnapshot) {
                    await deleteCodexUsageSnapshot();
                    emitUsageLiveUpdated();
                    await log('Cleared stored Codex usage because local auth is unavailable.');
                    return;
                }

                await log('Skipped Codex usage sync because local auth is unavailable.');
                return;
            }

            const softFailureMessage = getCodexUsageSoftFailureMessage(error);

            if (softFailureMessage) {
                await log(softFailureMessage);
                return;
            }

            const message = error instanceof Error ? error.message : String(error);
            await log(`Codex usage sync failed: ${message}`);
            await fail('Codex usage sync failed.', error);
        }
    });
