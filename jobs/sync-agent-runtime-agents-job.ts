import { type ZodType, z } from 'zod';
import { isAgentRuntimeReachable } from '../apps/server/src/agent-runtime-connection/service.ts';
import { syncRuntimeAgents } from '../apps/server/src/agents/sync.ts';
import { defineJob } from './define-job.ts';

const emptyInputSchema = z.object({}).strict() as ZodType<Record<string, unknown>>;

export const syncRuntimeAgentsJob = defineJob('sync-runtime-agents')
    .displayName('Sync Runtime Agents')
    .description('Reads configured runtime connections and stores agent projections for Tavern.')
    .input(emptyInputSchema)
    .defaultInput({})
    .interval({
        everyMs: 60 * 1000,
        runOnStart: true,
    })
    .enabledWhen(isAgentRuntimeReachable)
    .work(async ({ fail, log }) => {
        try {
            await syncRuntimeAgents({ log });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            await log(`Runtime agent sync failed: ${message}`);
            await fail('Runtime agent sync failed.', error);
        }
    });
