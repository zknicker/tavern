import { type ZodType, z } from 'zod';
import { emitUsageLiveUpdated } from '../apps/server/src/api/invalidation-events.ts';
import {
    deleteClaudeUsageSnapshot,
    getClaudeUsageSnapshot,
    saveClaudeUsageSnapshot,
} from '../apps/server/src/storage/provider-usage.ts';
import { ClaudeUsageAuthError, getClaudeUsage } from '../packages/claude-usage/src/index.ts';
import { defineJob } from './define-job.ts';
import { getClaudeUsageSoftFailureMessage } from './provider-usage-soft-failures.ts';

const emptyInputSchema = z.object({}).strict() as ZodType<Record<string, unknown>>;
const providerUsageJobIntervalMs = 5 * 60 * 1000;

export const syncClaudeCodeUsageJob = defineJob('sync-claude-code-usage')
    .displayName('Sync Claude Code Usage')
    .description('Reads Claude Code usage and stores the latest snapshot for the dashboard.')
    .input(emptyInputSchema)
    .defaultInput({})
    .interval({
        everyMs: providerUsageJobIntervalMs,
        runOnStart: true,
    })
    .work(async ({ fail, log }) => {
        try {
            const snapshot = await getClaudeUsage();

            await saveClaudeUsageSnapshot(snapshot);
            await log(`Stored Claude Code usage snapshot from ${snapshot.capturedAt}.`);
            emitUsageLiveUpdated();
        } catch (error) {
            if (error instanceof ClaudeUsageAuthError) {
                const existingSnapshot = await getClaudeUsageSnapshot();

                if (existingSnapshot) {
                    await deleteClaudeUsageSnapshot();
                    emitUsageLiveUpdated();
                    await log(
                        'Cleared stored Claude Code usage because local auth is unavailable.'
                    );
                    return;
                }

                await log('Skipped Claude Code usage sync because local auth is unavailable.');
                return;
            }

            const softFailureMessage = getClaudeUsageSoftFailureMessage(error);

            if (softFailureMessage) {
                await log(softFailureMessage);
                return;
            }

            const message = error instanceof Error ? error.message : String(error);
            await log(`Claude Code usage sync failed: ${message}`);
            await fail('Claude Code usage sync failed.', error);
        }
    });
