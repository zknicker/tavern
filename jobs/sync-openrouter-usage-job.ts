import { type ZodType, z } from 'zod';
import { emitUsageLiveUpdated } from '../apps/server/src/api/invalidation-events.ts';
import {
    getOpenRouterActivityOverview,
    type OpenRouterActivityError,
} from '../apps/server/src/openrouter/activity.ts';
import { getOpenRouterSettings } from '../apps/server/src/openrouter/settings.ts';
import {
    deleteOpenRouterUsageOverview,
    getOpenRouterUsageOverview,
    saveOpenRouterUsageOverview,
} from '../apps/server/src/storage/provider-usage.ts';
import { defineJob } from './define-job.ts';

const emptyInputSchema = z.object({}).strict() as ZodType<Record<string, unknown>>;
const openRouterUsageJobIntervalMs = 5 * 60 * 1000;

export const syncOpenRouterUsageJob = defineJob('sync-openrouter-usage')
    .displayName('Sync OpenRouter Usage')
    .description('Reads OpenRouter activity and stores the latest overview for the dashboard.')
    .input(emptyInputSchema)
    .defaultInput({})
    .interval({
        everyMs: openRouterUsageJobIntervalMs,
        runOnStart: true,
    })
    .enabledWhen(async () => Boolean((await getOpenRouterSettings())?.managementApiKey))
    .work(async ({ fail, log }) => {
        const settings = await getOpenRouterSettings();

        if (!settings?.managementApiKey) {
            const existingOverview = await getOpenRouterUsageOverview();

            if (existingOverview) {
                await deleteOpenRouterUsageOverview();
                emitUsageLiveUpdated();
                await log(
                    'Cleared stored OpenRouter usage because no management key is configured.'
                );
                return;
            }

            await log('Skipped OpenRouter usage sync because no management key is configured.');
            return;
        }

        try {
            const capturedAt = new Date();
            const overview = await getOpenRouterActivityOverview(
                settings.managementApiKey,
                capturedAt
            );

            await saveOpenRouterUsageOverview(overview, capturedAt.toISOString());
            await log(`Stored OpenRouter usage overview from ${capturedAt.toISOString()}.`);
            emitUsageLiveUpdated();
        } catch (error) {
            const details =
                error instanceof Error && 'details' in error && error.details
                    ? (error.details as OpenRouterActivityError)
                    : null;

            if (details?.code === 'auth') {
                const existingOverview = await getOpenRouterUsageOverview();

                if (existingOverview) {
                    await deleteOpenRouterUsageOverview();
                    emitUsageLiveUpdated();
                }

                await log(`Skipped OpenRouter usage sync: ${details.message}`);
                return;
            }

            const message = error instanceof Error ? error.message : String(error);
            await log(`OpenRouter usage sync failed: ${message}`);
            await fail('OpenRouter usage sync failed.', error);
        }
    });
