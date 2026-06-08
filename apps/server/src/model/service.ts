import { createAgentRuntimeClientForConnection } from '../agent-runtime/client-factory.ts';
import { getAgentRuntimeModels } from '../agent-runtime/models.ts';
import { listAgentCatalog } from '../agents/catalog.ts';
import { getOpenRouterSettings } from '../openrouter/settings.ts';
import { listConfiguredAgentRuntimeConnections } from '../storage/agent-runtime-connections.ts';
import { listAgents as listAgentRecords, parseAgentRawJson } from '../storage/agents.ts';
import { modelListSchema } from './contracts.ts';
import { formatHermesModelName, normalizeHermesModelIdentity } from './hermes-mapping.ts';

function parseRuntimeModelCatalogEntry(input: { id: string; provider: null | string }) {
    const separatorIndex = input.id.indexOf('/');
    const provider =
        input.provider ?? (separatorIndex > 0 ? input.id.slice(0, separatorIndex) : null);
    const model = separatorIndex > 0 ? input.id.slice(separatorIndex + 1) : input.id;

    return provider ? { model, provider } : null;
}

function createEmptySelection() {
    return {
        fallbackModels: [],
        primaryModel: null,
    };
}

async function buildModels() {
    const runtimes = await listConfiguredAgentRuntimeConnections();
    const modelsByRef = new Map<string, ReturnType<typeof createHermesModel>>();

    for (const runtime of runtimes) {
        const client = createAgentRuntimeClientForConnection(runtime);
        try {
            const response = await getAgentRuntimeModels(client, runtime.id);

            for (const model of response?.models ?? []) {
                const parsed = parseRuntimeModelCatalogEntry(model);

                if (!parsed) {
                    continue;
                }

                const ref = formatHermesModelName(parsed);
                modelsByRef.set(
                    ref,
                    createHermesModel({
                        availability: 'available',
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
    const [agents, agentRecords] = await Promise.all([listAgentCatalog(), listAgentRecords()]);
    const agentRecordsById = new Map(
        agentRecords.map((agentRecord) => [agentRecord.id, agentRecord] as const)
    );
    return agents.map((agent) => {
        const agentRecord = agentRecordsById.get(agent.id);
        const rawAgent = agentRecord ? parseAgentRawJson(agentRecord) : null;
        const runtimeModelName = rawAgent?.hermesModelName ?? null;
        const runtimeThinkingDefault = rawAgent?.thinkingDefault ?? null;
        const runtimeModel = runtimeModelName
            ? normalizeHermesModelIdentity({
                  harness: runtimeModelName.harness,
                  model: runtimeModelName.model,
                  provider: runtimeModelName.provider,
              })
            : null;

        return {
            agentId: agent.id,
            agentName: agent.name,
            effective: createEmptySelection(),
            effectiveThinkingDefault: runtimeThinkingDefault,
            harness: runtimeModel?.hermesHarness ?? null,
            isOverridden: Boolean(runtimeModel),
            isThinkingOverridden: runtimeThinkingDefault !== null,
            model: runtimeModel?.modelId ?? null,
            modelRef: runtimeModel?.modelCatalogId ?? null,
            provider: runtimeModel?.provider ?? null,
            override: createEmptySelection(),
            overrideThinkingDefault: runtimeThinkingDefault,
            subAgentModel: null,
            syncError: null,
            syncedAt: agentRecord?.lastSyncedAt ?? null,
        };
    });
}

export async function listModels() {
    const [agents, models, openRouterSettings] = await Promise.all([
        buildAgentSettings(),
        buildModels(),
        getOpenRouterSettings(),
    ]);

    return modelListSchema.parse({
        agents,
        defaults: createEmptySelection(),
        defaultsThinkingLevel: null,
        models,
        openRouter: {
            hasApiKey: Boolean(openRouterSettings?.hasApiKey),
            updatedAt: openRouterSettings?.updatedAt ?? null,
        },
        subAgentDefaultModel: null,
        subAgentThinkingLevel: null,
    });
}

function createHermesModel(input: {
    availability: 'available' | 'configured';
    label: string | null;
    model: string;
    provider: string;
}) {
    const ref = formatHermesModelName(input);

    return {
        availability: input.availability,
        contextWindow: null,
        framework: 'hermes',
        id: ref,
        modelId: input.model,
        name: input.label?.trim() || input.model,
        provider: input.provider,
        reasoning: null,
        ref,
        supportsChatRouting: true,
    };
}
