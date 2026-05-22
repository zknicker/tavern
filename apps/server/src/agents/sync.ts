import { syncAgentRuntimeAgents } from '../sync/agent-runtime-sync.ts';

export interface RuntimeAgentSyncResult {
    deleted: number;
    runtimeId: string;
    runtimeName: string;
    synced: number;
}

export async function syncRuntimeAgents(input?: {
    log?: (message: string) => Promise<void>;
}): Promise<RuntimeAgentSyncResult[]> {
    return await syncAgentRuntimeAgents(input);
}
