import type {
    AgentRuntimeOpenClawConfigSnapshot,
    AgentRuntimeSaveDiscordBinding,
    AgentRuntimeThinkingLevel,
} from '@tavern/api';
import type { TavernAgentRuntimeClient } from '../agent-runtime/client.ts';
import {
    createConfiguredAgentRuntimeClient,
    createConfiguredAgentRuntimeClientForRuntimeId,
    getCurrentConfiguredAgentRuntimeConnection,
} from '../agent-runtime/configured-client.ts';
import { getAgent } from '../agents/catalog.ts';
import {
    emitAgentUpdated,
    emitModelUpdated,
    emitOpenClawConfigUpdated,
} from '../api/invalidation-events.ts';
import { syncAgentsForRuntime } from '../storage/agents.ts';
import { getOpenClawModelNameRecord } from '../storage/models.ts';
import {
    getOpenClawConfigSnapshot,
    saveOpenClawConfigSnapshot,
} from '../storage/openclaw-config-snapshots.ts';
import { syncAgentWorkspaceInstructions } from '../sync/agent-runtime-sync.ts';
import { readOpenClawDiscordBindings } from './discord-bindings.ts';

export async function updateOpenClawAgentName(input: { agentId: string; name: string }) {
    const { client, runtimeId } = await createClientForAgent(input.agentId);

    try {
        const result = await client.updateAgentName(input.agentId, {
            name: input.name,
        });
        await persistOpenClawConfigSnapshot({ runtimeId, snapshot: result });
        await refreshAgentSnapshot({ client, runtimeId });
        emitAgentUpdated();
        return result;
    } finally {
        client.close();
    }
}

export async function updateOpenClawAgentModel(input: {
    agentId: string;
    openClawModelNameId: string;
}) {
    const record = await getOpenClawModelNameRecord(input.openClawModelNameId);

    if (!record) {
        throw new Error(`Unknown OpenClaw model name "${input.openClawModelNameId}".`);
    }

    const { client, runtimeId } = await createClientForAgent(input.agentId);

    try {
        const result = await client.updateAgentModel(input.agentId, {
            model: {
                harness: record.harness as 'codex' | 'pi',
                model: record.openClawModel,
                provider: record.openClawProvider,
            },
        });
        await persistOpenClawConfigSnapshot({ runtimeId, snapshot: result });
        await refreshAgentSnapshot({ client, runtimeId });
        emitAgentUpdated();
        emitModelUpdated();
        return result;
    } finally {
        client.close();
    }
}

export async function updateOpenClawAgentThinkingDefault(input: {
    agentId: string;
    thinkingDefault: AgentRuntimeThinkingLevel | null;
}) {
    const { client, runtimeId } = await createClientForAgent(input.agentId);

    try {
        const result = await client.updateAgentThinkingDefault(input.agentId, {
            thinkingDefault: input.thinkingDefault,
        });
        await persistOpenClawConfigSnapshot({ runtimeId, snapshot: result });
        await refreshAgentSnapshot({ client, runtimeId });
        emitAgentUpdated();
        emitModelUpdated();
        return result;
    } finally {
        client.close();
    }
}

export async function saveOpenClawDiscordBinding(input: AgentRuntimeSaveDiscordBinding) {
    const { client, runtimeId } = await createClientForAgent(input.agentId);

    try {
        const result = await client.saveDiscordBinding(input);
        await persistOpenClawConfigSnapshot({ runtimeId, snapshot: result });
        return result;
    } finally {
        client.close();
    }
}

export async function listOpenClawDiscordBindings() {
    const connection = getCurrentConfiguredAgentRuntimeConnection();

    if (!connection) {
        return [];
    }

    const cachedBindings = await listCachedOpenClawDiscordBindings(connection.id);
    const client = createConfiguredAgentRuntimeClient();

    if (!client) {
        return cachedBindings;
    }

    try {
        return (await client.listDiscordBindings()).bindings;
    } catch {
        return cachedBindings;
    } finally {
        client.close();
    }
}

export async function listCachedOpenClawDiscordBindings(runtimeId: string) {
    const snapshot = await getOpenClawConfigSnapshot(runtimeId);

    if (!snapshot) {
        return [];
    }

    return readOpenClawDiscordBindings(JSON.parse(snapshot.configJson) as Record<string, unknown>);
}

export async function deleteOpenClawDiscordBinding(input: { agentId: string; bindingId: string }) {
    const { client, runtimeId } = await createClientForAgent(input.agentId);

    try {
        const result = await client.deleteDiscordBinding(input.bindingId, {});
        await persistOpenClawConfigSnapshot({ runtimeId, snapshot: result });
        return result;
    } finally {
        client.close();
    }
}

async function createClientForAgent(agentId: string) {
    const agent = await getAgent(agentId);

    if (!agent) {
        throw new Error(`No agent named "${agentId}" exists.`);
    }

    const client = await createConfiguredAgentRuntimeClientForRuntimeId(agent.runtimeId);

    if (!client) {
        throw new Error(`No enabled Tavern Runtime connection exists for agent "${agentId}".`);
    }

    return {
        client,
        runtimeId: agent.runtimeId,
    };
}

async function refreshAgentSnapshot(input: {
    client: TavernAgentRuntimeClient;
    runtimeId: string;
}) {
    const { agents } = await input.client.listAgents();
    await syncAgentsForRuntime({
        agents,
        runtimeId: input.runtimeId,
    });
    await syncAgentWorkspaceInstructions({
        agents,
        client: input.client,
        runtimeId: input.runtimeId,
    });
}

async function persistOpenClawConfigSnapshot(input: {
    runtimeId: string;
    snapshot: AgentRuntimeOpenClawConfigSnapshot;
}) {
    await saveOpenClawConfigSnapshot(input);
    emitOpenClawConfigUpdated();
}
