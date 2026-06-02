import type { AgentRuntimeSkillSummary } from '@tavern/api';
import { createAgentRuntimeClientForConnection } from '../agent-runtime/client-factory.ts';
import { listAgentRuntimeSkills } from '../agent-runtime/skills.ts';
import { emitSkillInvalidationCascade } from '../api/invalidation-events.ts';
import { listReachableAgentRuntimeConnections } from '../storage/agent-runtime-connections.ts';
import {
    getSkillInventorySyncState,
    listSkillRecordsForRuntime,
    markSkillInventoryRefreshError,
    saveSkillRecordsForRuntime,
} from '../storage/skills.ts';

export const runtimeSkillInventoryRefreshIntervalMs = 15 * 60 * 1000;

function toErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
}

export function isRuntimeSkillInventoryStale(input: { lastSyncedAt: string | null; now?: Date }) {
    if (!input.lastSyncedAt) {
        return true;
    }

    const lastSyncedAtMs = new Date(input.lastSyncedAt).getTime();

    if (Number.isNaN(lastSyncedAtMs)) {
        return true;
    }

    return (
        (input.now?.getTime() ?? Date.now()) - lastSyncedAtMs >
        runtimeSkillInventoryRefreshIntervalMs
    );
}

export async function getCachedRuntimeSkillInventory(runtimeId: string): Promise<{
    lastError: null | string;
    lastSyncedAt: null | string;
    skills: AgentRuntimeSkillSummary[];
}> {
    const [state, skills] = await Promise.all([
        getSkillInventorySyncState(runtimeId),
        listSkillRecordsForRuntime(runtimeId),
    ]);

    return {
        lastError: state?.lastError ?? null,
        lastSyncedAt: state?.lastSuccessfulAt ?? null,
        skills,
    };
}

export async function refreshRuntimeSkillInventory(input?: {
    log?: (message: string) => Promise<void>;
}) {
    const runtimes = await listReachableAgentRuntimeConnections();
    let changed = false;
    let refreshed = 0;

    if (runtimes.length === 0) {
        await input?.log?.(
            'Skipped runtime skill inventory refresh because no runtime is reachable.'
        );
        return { changed, refreshed };
    }

    for (const runtime of runtimes) {
        const client = createAgentRuntimeClientForConnection(runtime);

        try {
            const skills = (await listAgentRuntimeSkills(client, runtime.id)) ?? [];
            const result = await saveSkillRecordsForRuntime({
                runtimeId: runtime.id,
                skills: skills as AgentRuntimeSkillSummary[],
            });
            refreshed += 1;
            changed = changed || result.changed;
            await input?.log?.(`Stored ${skills.length} runtime skill(s) for ${runtime.name}.`);
        } catch (error) {
            const message = toErrorMessage(error);
            await markSkillInventoryRefreshError({
                error: message,
                runtimeId: runtime.id,
            });
            await input?.log?.(
                `Runtime skill inventory refresh failed for ${runtime.name}: ${message}`
            );
        } finally {
            client.close();
        }
    }

    if (changed) {
        emitSkillInvalidationCascade();
    }

    return { changed, refreshed };
}
