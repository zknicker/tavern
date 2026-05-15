import { type ZodType, z } from 'zod';
import { isAgentRuntimeReachable } from '../apps/server/src/agent-runtime-connection/service.ts';
import { syncOpenClawConfigSnapshots } from '../apps/server/src/openclaw-config/service.ts';
import { defineJob } from './define-job.ts';

const emptyInputSchema = z.object({}).strict() as ZodType<Record<string, unknown>>;

export const syncRuntimeConfigJob = defineJob('sync-runtime-config')
    .displayName('Sync Runtime Config')
    .description('Reads the full runtime config snapshot for Tavern settings drafts.')
    .input(emptyInputSchema)
    .defaultInput({})
    .interval({
        everyMs: 60 * 1000,
        runOnStart: true,
    })
    .enabledWhen(isAgentRuntimeReachable)
    .work(async ({ fail, log }) => {
        try {
            await syncOpenClawConfigSnapshots({ log });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            await log(`Runtime config sync failed: ${message}`);
            await fail('Runtime config sync failed.', error);
        }
    });
