import type {
    AgentRuntimeHermesConfigSnapshot,
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
    emitHermesConfigUpdated,
    emitModelUpdated,
} from '../api/invalidation-events.ts';
import { inferHermesHarness, parseHermesModelRef } from '../model/hermes-mapping.ts';
import { syncAgentsForRuntime } from '../storage/agents.ts';
import {
    getHermesConfigSnapshot,
    saveHermesConfigSnapshot,
} from '../storage/hermes-config-snapshots.ts';
import { syncAgentWorkspaceInstructions } from '../sync/agent-runtime-sync.ts';
import { readHermesDiscordBindings } from './discord-bindings.ts';

export async function updateHermesAgentName(input: { agentId: string; name: string }) {
    const { client, runtimeId } = await createClientForAgent(input.agentId);

    try {
        const result = await client.updateAgentName(input.agentId, {
            name: input.name,
        });
        await persistHermesConfigSnapshot({ runtimeId, snapshot: result });
        await refreshAgentSnapshot({ client, runtimeId });
        emitAgentUpdated();
        return result;
    } finally {
        client.close();
    }
}

export async function updateHermesAgentModel(input: { agentId: string; modelRef: string }) {
    const model = parseHermesModelRef(input.modelRef);

    const { client, runtimeId } = await createClientForAgent(input.agentId);

    try {
        const result = await client.updateAgentModel(input.agentId, {
            model: {
                harness: inferHermesHarness(model.provider),
                model: model.model,
                provider: model.provider,
            },
        });
        await persistHermesConfigSnapshot({ runtimeId, snapshot: result });
        await refreshAgentSnapshot({ client, runtimeId });
        emitAgentUpdated();
        emitModelUpdated();
        return result;
    } finally {
        client.close();
    }
}

export async function updateHermesAgentThinkingDefault(input: {
    agentId: string;
    thinkingDefault: AgentRuntimeThinkingLevel | null;
}) {
    const { client, runtimeId } = await createClientForAgent(input.agentId);

    try {
        const result = await client.updateAgentThinkingDefault(input.agentId, {
            thinkingDefault: input.thinkingDefault,
        });
        await persistHermesConfigSnapshot({ runtimeId, snapshot: result });
        await refreshAgentSnapshot({ client, runtimeId });
        emitAgentUpdated();
        emitModelUpdated();
        return result;
    } finally {
        client.close();
    }
}

export async function updateHermesAgentTools(input: { agentId: string; tools: string[] }) {
    const { client, runtimeId } = await createClientForAgent(input.agentId);

    try {
        const result = await client.updateAgentTools(input.agentId, {
            tools: input.tools,
        });
        await persistHermesConfigSnapshot({ runtimeId, snapshot: result });
        return result;
    } finally {
        client.close();
    }
}

export async function saveHermesDiscordBinding(input: AgentRuntimeSaveDiscordBinding) {
    const { client, runtimeId } = await createClientForAgent(input.agentId);

    try {
        const result = await client.saveDiscordBinding(input);
        await persistHermesConfigSnapshot({ runtimeId, snapshot: result });
        return result;
    } finally {
        client.close();
    }
}

export async function listHermesDiscordBindings() {
    const connection = getCurrentConfiguredAgentRuntimeConnection();

    if (!connection) {
        return [];
    }

    const cachedBindings = await listCachedHermesDiscordBindings(connection.id);
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

export async function listCachedHermesDiscordBindings(runtimeId: string) {
    const snapshot = await getHermesConfigSnapshot(runtimeId);

    if (!snapshot) {
        return [];
    }

    return readHermesDiscordBindings(JSON.parse(snapshot.configJson) as Record<string, unknown>);
}

export async function deleteHermesDiscordBinding(input: { agentId: string; bindingId: string }) {
    const { client, runtimeId } = await createClientForAgent(input.agentId);

    try {
        const result = await client.deleteDiscordBinding(input.bindingId, {});
        await persistHermesConfigSnapshot({ runtimeId, snapshot: result });
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

async function persistHermesConfigSnapshot(input: {
    runtimeId: string;
    snapshot: AgentRuntimeHermesConfigSnapshot;
}) {
    await saveHermesConfigSnapshot(input);
    emitHermesConfigUpdated();
}
