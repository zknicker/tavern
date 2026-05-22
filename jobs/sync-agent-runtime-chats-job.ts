import { type ZodType, z } from 'zod';
import { isAgentRuntimeReachable } from '../apps/server/src/agent-runtime-connection/service.ts';
import { syncAgentRuntimeChats } from '../apps/server/src/sync/agent-runtime-sync.ts';
import { defineJob } from './define-job.ts';

const emptyInputSchema = z.object({}).strict() as ZodType<Record<string, unknown>>;

export const syncRuntimeChatsJob = defineJob('sync-runtime-chats')
    .displayName('Sync Runtime Chats')
    .description('Reads configured runtime connections and stores chat records for Tavern.')
    .input(emptyInputSchema)
    .defaultInput({})
    .interval({
        everyMs: 60 * 1000,
        runOnStart: true,
    })
    .enabledWhen(isAgentRuntimeReachable)
    .work(async ({ fail, log }) => {
        try {
            await syncAgentRuntimeChats({ log });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            await log(`Runtime chat sync failed: ${message}`);
            await fail('Runtime chat sync failed.', error);
        }
    });
