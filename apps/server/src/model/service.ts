import type { AgentRuntimeAgent, AgentRuntimeModelCapability } from '@tavern/api';
import { createAgentRuntimeClientForConnection } from '../agent-runtime/client-factory.ts';
import { getAgentRuntimeModels } from '../agent-runtime/models.ts';
import { listAgentCatalog } from '../agents/catalog.ts';
import { getOpenRouterSettings } from '../openrouter/settings.ts';
import { listConfiguredAgentRuntimeConnections } from '../storage/agent-runtime-connections.ts';
import { listAgents as listAgentRecords, parseAgentRawJson } from '../storage/agents.ts';
import { modelListSchema } from './contracts.ts';
import { formatAgentModelName, normalizeAgentModelIdentity } from './model-mapping.ts';

function parseRuntimeModelCatalogEntry(input: { route: { model: string; provider: string } }) {
    return {
        model: input.route.model,
        provider: input.route.provider,
    };
}

async function buildModels() {
    const runtimes = await listConfiguredAgentRuntimeConnections();
    const modelsByRef = new Map<string, ReturnType<typeof createAgentModel>>();

    for (const runtime of runtimes) {
        const client = createAgentRuntimeClientForConnection(runtime);
        try {
            const response = await getAgentRuntimeModels(client, runtime.id);

            for (const model of response?.models ?? []) {
                const parsed = parseRuntimeModelCatalogEntry(model);

                const ref = formatAgentModelName(parsed);
                modelsByRef.set(
                    ref,
                    createAgentModel({
                        availability: model.availability ?? 'available',
                        capability: model.capability,
                        label: model.label ?? null,
                        model: parsed.model,
                        provider: parsed.provider,
                    })
                );
            }
        } finally {
            client.close();
        }
    }

    return [...modelsByRef.values()].sort(
        (left, right) =>
            left.name.localeCompare(right.name) ||
            left.provider.localeCompare(right.provider) ||
            left.modelId.localeCompare(right.modelId)
    );
}

async function buildAgentSettings() {
    const [agents, agentRecords, runtimeAgentsByKey] = await Promise.all([
        listAgentCatalog(),
        listAgentRecords(),
        listRuntimeAgentFactsByKey(),
    ]);
    const agentRecordsById = new Map(
        agentRecords.map((agentRecord) => [agentRecord.id, agentRecord] as const)
    );
    return Promise.all(
        agents.map(async (agent) => {
            const agentRecord = agentRecordsById.get(agent.id);
            const rawAgent = agentRecord ? parseAgentRawJson(agentRecord) : null;
            const runtimeAgent = runtimeAgentsByKey.get(`${agent.runtimeId}:${agent.id}`)?.agent;
            const runtimeModelName = runtimeAgent
                ? (runtimeAgent.modelName ?? null)
                : (rawAgent?.modelName ?? null);
            const runtimeThinkingDefault =
                runtimeAgent && 'thinkingDefault' in runtimeAgent
                    ? (runtimeAgent.thinkingDefault ?? null)
                    : (rawAgent?.thinkingDefault ?? null);
            const runtimeModel = runtimeModelName
                ? normalizeAgentModelIdentity({
                      model: runtimeModelName.model,
                      provider: runtimeModelName.provider,
                  })
                : null;

            return {
                agentId: agent.id,
                agentName: agent.name,
                effectiveThinkingDefault: runtimeThinkingDefault,
                isOverridden: Boolean(runtimeModel),
                isThinkingOverridden: runtimeThinkingDefault !== null,
                model: runtimeModel?.modelId ?? null,
                modelRef: runtimeModel?.modelRef ?? null,
                overrideThinkingDefault: runtimeThinkingDefault,
                provider: runtimeModel?.provider ?? null,
                syncError: null,
                syncedAt: agentRecord?.lastSyncedAt ?? null,
            };
        })
    );
}

async function listRuntimeAgentFactsByKey() {
    const runtimes = await listConfiguredAgentRuntimeConnections();
    const agents = new Map<string, { agent: AgentRuntimeAgent }>();

    for (const runtime of runtimes) {
        const client = createAgentRuntimeClientForConnection(runtime);
        try {
            const response = await client.listAgents();
            for (const agent of response.agents) {
                agents.set(`${runtime.id}:${agent.id}`, {
                    agent,
                });
            }
        } finally {
            client.close();
        }
    }

    return agents;
}

export async function listModels() {
    const [agents, models, openRouterSettings] = await Promise.all([
        buildAgentSettings(),
        buildModels(),
        getOpenRouterSettings(),
    ]);

    return modelListSchema.parse({
        agents,
        defaultsThinkingLevel: null,
        models,
        openRouter: {
            hasApiKey: Boolean(openRouterSettings?.hasApiKey),
            updatedAt: openRouterSettings?.updatedAt ?? null,
        },
        subAgentThinkingLevel: null,
    });
}

function createAgentModel(input: {
    availability: 'available' | 'configured' | 'degraded' | 'unavailable';
    capability: AgentRuntimeModelCapability;
    label: string | null;
    model: string;
    provider: string;
}) {
    const ref = formatAgentModelName(input);

    return {
        availability: input.availability,
        capability: input.capability,
        contextWindow: null,
        framework: 'agent-engine',
        id: ref,
        modelId: input.model,
        name: input.label?.trim() || input.model,
        provider: input.provider,
        reasoning: null,
        ref,
    };
}
