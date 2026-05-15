import { createAgentRuntimeClientForConnection } from '../agent-runtime/client-factory.ts';
import { getAgentRuntimeModels } from '../agent-runtime/models.ts';
import { listAgentCatalog } from '../agents/catalog.ts';
import { getOpenRouterSettings } from '../openrouter/settings.ts';
import { listConfiguredAgentRuntimeConnections } from '../storage/agent-runtime-connections.ts';
import { listAgents as listAgentProjections, parseAgentRawJson } from '../storage/agents.ts';
import {
    listAgentModelSettings,
    listModelCatalogRecords,
    listOpenClawModelNameRecords,
    listRuntimeModelAvailability,
    seedModelCatalog,
    syncRuntimeModelAvailability,
} from '../storage/models.ts';
import { modelListSchema } from './contracts.ts';
import {
    formatOpenClawModelName,
    formatOpenClawModelNameId,
    normalizeOpenClawModelIdentity,
    type OpenClawHarness,
    openClawModelNames,
} from './openclaw-mapping.ts';

function formatModelRef(input: { modelId: string; provider: string }) {
    return `${input.provider}/${input.modelId}`;
}

function createEmptySelection() {
    return {
        fallbackModels: [],
        primaryModel: null,
    };
}

async function refreshRuntimeModelAvailability() {
    const runtimes = await listConfiguredAgentRuntimeConnections();

    for (const runtime of runtimes) {
        try {
            const client = createAgentRuntimeClientForConnection(runtime);
            try {
                const models = await getAgentRuntimeModels(client, runtime.id);

                if (!models) {
                    continue;
                }

                const modelNameIds = models.configuredModels.flatMap((model) => {
                    const canonical = normalizeOpenClawModelIdentity({
                        model: model.modelId,
                        provider: model.provider,
                    });

                    if (canonical?.openClawModelNameId) {
                        return [canonical.openClawModelNameId];
                    }

                    const modelCatalogId = `${model.provider}/${model.modelId}`;
                    const matchingNames = openClawModelNames
                        .filter((name) => name.modelCatalogId === modelCatalogId)
                        .map((name) =>
                            formatOpenClawModelNameId({
                                harness: name.harness,
                                model: name.openClawModel,
                                provider: name.openClawProvider,
                            })
                        );

                    if (matchingNames.length > 0) {
                        return matchingNames;
                    }

                    return [];
                });

                await syncRuntimeModelAvailability({
                    modelNameIds,
                    runtimeId: runtime.id,
                    source: 'models.list',
                    status: 'available',
                });
            } finally {
                client.close();
            }
        } catch {
            // Availability is a freshness hint. Existing catalog/settings stay renderable.
        }
    }
}

async function buildModels() {
    await seedModelCatalog();
    await refreshRuntimeModelAvailability();

    const [catalog, openClawNames, runtimes] = await Promise.all([
        listModelCatalogRecords(),
        listOpenClawModelNameRecords(),
        listConfiguredAgentRuntimeConnections(),
    ]);
    const availabilityRows = await listRuntimeModelAvailability(
        runtimes.map((runtime) => runtime.id)
    );
    const availableNameIds = new Set(
        availabilityRows
            .filter((row) => row.status === 'available')
            .map((row) => row.openClawModelNameId)
    );

    return catalog
        .map((model) => {
            const ref = formatModelRef(model);
            const names = openClawNames.filter((name) => name.modelCatalogId === model.id);

            return {
                availability: names.some((name) => availableNameIds.has(name.id))
                    ? 'configured'
                    : 'available',
                contextWindow: model.contextWindow,
                framework: 'tavern',
                id: ref,
                modelId: model.modelId,
                name: model.displayName,
                openClawNames: names.map((name) => ({
                    available: availableNameIds.has(name.id),
                    harness: name.harness as OpenClawHarness,
                    id: name.id,
                    isPreferred: name.isPreferred,
                    label: formatOpenClawModelName({
                        model: name.openClawModel,
                        provider: name.openClawProvider,
                    }),
                    model: name.openClawModel,
                    provider: name.openClawProvider,
                })),
                provider: model.provider,
                reasoning: null,
                ref,
                supportsChatRouting: true,
            };
        })
        .sort(
            (left, right) =>
                left.name.localeCompare(right.name) ||
                left.provider.localeCompare(right.provider) ||
                left.modelId.localeCompare(right.modelId)
        );
}

async function buildAgentSettings() {
    const [agents, projections] = await Promise.all([listAgentCatalog(), listAgentProjections()]);
    const projectionsByAgentId = new Map(
        projections.map((projection) => [projection.id, projection] as const)
    );
    const settings = await listAgentModelSettings(agents.map((agent) => agent.id));
    const settingsByAgentId = new Map(settings.map((setting) => [setting.agentId, setting]));

    return agents.map((agent) => {
        const setting = settingsByAgentId.get(agent.id);
        const projection = projectionsByAgentId.get(agent.id);
        const rawAgent = projection ? parseAgentRawJson(projection) : null;
        const runtimeModelName = rawAgent?.openClawModelName ?? null;
        const runtimeThinkingDefault = rawAgent?.thinkingDefault ?? null;
        const runtimeModel = runtimeModelName
            ? normalizeOpenClawModelIdentity({
                  harness: runtimeModelName.harness,
                  model: runtimeModelName.model,
                  provider: runtimeModelName.provider,
              })
            : null;
        const settingIsNewerThanProjection =
            setting?.syncedAt &&
            projection?.lastSyncedAt &&
            new Date(setting.syncedAt).getTime() > new Date(projection.lastSyncedAt).getTime();
        const settingErrorIsCurrent =
            setting?.syncError &&
            projection?.lastSyncedAt &&
            new Date(setting.updatedAt).getTime() > new Date(projection.lastSyncedAt).getTime();
        const shouldPreferSetting = Boolean(settingIsNewerThanProjection);
        const selectedHarness = shouldPreferSetting
            ? ((setting?.harness as OpenClawHarness | undefined) ?? runtimeModel?.openClawHarness)
            : (runtimeModel?.openClawHarness ?? (setting?.harness as OpenClawHarness | undefined));
        const selectedModelId = shouldPreferSetting
            ? (setting?.modelCatalogId ?? runtimeModel?.modelCatalogId)
            : (runtimeModel?.modelCatalogId ?? setting?.modelCatalogId);
        const selectedOpenClawModelNameId = shouldPreferSetting
            ? (setting?.openClawModelNameId ?? runtimeModel?.openClawModelNameId)
            : (runtimeModel?.openClawModelNameId ?? setting?.openClawModelNameId);
        const settingMatchesRuntime = Boolean(
            setting &&
                runtimeModel &&
                setting.harness === runtimeModel.openClawHarness &&
                setting.modelCatalogId === runtimeModel.modelCatalogId &&
                setting.openClawModelNameId === runtimeModel.openClawModelNameId
        );

        return {
            agentId: agent.id,
            agentName: agent.name,
            effective: createEmptySelection(),
            effectiveThinkingDefault: runtimeThinkingDefault,
            harness: selectedHarness ?? null,
            isOverridden: Boolean(setting ?? runtimeModel),
            isThinkingOverridden: runtimeThinkingDefault !== null,
            modelId: selectedModelId ?? null,
            openClawModelNameId: selectedOpenClawModelNameId ?? null,
            override: createEmptySelection(),
            overrideThinkingDefault: runtimeThinkingDefault,
            subAgentModel: null,
            syncError:
                settingMatchesRuntime || !(settingErrorIsCurrent || !runtimeModel)
                    ? null
                    : (setting?.syncError ?? null),
            syncedAt: setting?.syncedAt ?? null,
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
