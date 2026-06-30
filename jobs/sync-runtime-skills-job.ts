import { type ZodType, z } from 'zod';
import {
    refreshRuntimeSkillInventory,
    runtimeSkillInventoryRefreshIntervalMs,
} from '../apps/server/src/skills/inventory-sync.ts';
import { defineJob } from './define-job.ts';

const emptyInputSchema = z.object({}).strict() as ZodType<Record<string, unknown>>;

export const syncRuntimeSkillsJob = defineJob('sync-runtime-skills')
    .displayName('Sync Runtime Skills')
    .description('Reads runtime skill inventory and stores the latest snapshot for settings.')
    .input(emptyInputSchema)
    .defaultInput({})
    .interval({
        everyMs: runtimeSkillInventoryRefreshIntervalMs,
        runOnStart: true,
    })
    .work(async ({ log }) => {
        const result = await refreshRuntimeSkillInventory({ log });

        if (result.refreshed === 0) {
            await log('No runtime skill inventory was refreshed.');
        }

        if (result.changed) {
            await log('Runtime skill inventory changed.');
        }
    });
