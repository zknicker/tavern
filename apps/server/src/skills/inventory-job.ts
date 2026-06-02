import { runJobUnlessQueued } from '../jobs/service.ts';
import { getCachedRuntimeSkillInventory, isRuntimeSkillInventoryStale } from './inventory-sync.ts';

const syncRuntimeSkillsJobSlug = 'sync-runtime-skills';

export async function enqueueRuntimeSkillInventoryRefresh() {
    return await runJobUnlessQueued(syncRuntimeSkillsJobSlug, undefined);
}

export async function enqueueRuntimeSkillInventoryRefreshIfStale(runtimeId: string | null) {
    if (!runtimeId) {
        return null;
    }

    const cached = await getCachedRuntimeSkillInventory(runtimeId);

    if (!isRuntimeSkillInventoryStale({ lastSyncedAt: cached?.lastSyncedAt ?? null })) {
        return null;
    }

    return await enqueueRuntimeSkillInventoryRefresh();
}
