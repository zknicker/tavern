import { type ZodType, z } from 'zod';
import { isAgentRuntimeReachable } from '../apps/server/src/agent-runtime-connection/service.ts';
import { syncAgentRuntimeSessions } from '../apps/server/src/sync/agent-runtime-projections.ts';
import { defineJob } from './define-job.ts';

const emptyInputSchema = z.object({}).strict() as ZodType<Record<string, unknown>>;

export const syncRuntimeSessionsJob = defineJob('sync-runtime-sessions')
    .displayName('Sync Runtime Sessions')
    .description('Reads configured runtime connections and stores session projections for Tavern.')
    .input(emptyInputSchema)
    .defaultInput({})
    .interval({
        everyMs: 60 * 1000,
        runOnStart: true,
    })
    .enabledWhen(isAgentRuntimeReachable)
    .work(async ({ fail, log }) => {
        try {
            await syncAgentRuntimeSessions({ log });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            await log(`Runtime session sync failed: ${message}`);
            await fail('Runtime session sync failed.', error);
        }
    });
