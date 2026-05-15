import { type ZodType, z } from 'zod';
import { isAgentRuntimeReachable } from '../apps/server/src/agent-runtime-connection/service.ts';
import { syncAgentRuntimeCron } from '../apps/server/src/sync/agent-runtime-projections.ts';
import { defineJob } from './define-job.ts';

const emptyInputSchema = z.object({}).strict() as ZodType<Record<string, unknown>>;

export const syncRuntimeCronJob = defineJob('sync-runtime-cron')
    .displayName('Sync Runtime Cron')
    .description('Reads configured runtime connections and stores cron projections for Tavern.')
    .input(emptyInputSchema)
    .defaultInput({})
    .interval({
        everyMs: 60 * 1000,
        runOnStart: true,
    })
    .enabledWhen(isAgentRuntimeReachable)
    .work(async ({ fail, log }) => {
        try {
            await syncAgentRuntimeCron({ log });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            await log(`Runtime cron sync failed: ${message}`);
            await fail('Runtime cron sync failed.', error);
        }
    });
