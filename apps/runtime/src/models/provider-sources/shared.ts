import type { AgentRuntimeModelCatalogEntry, AgentRuntimeModels } from '@tavern/api';
import { missingCliCommandMessage, resolveCliCommand } from '../../agent-engine/cli-command.ts';
import { readConfigValue } from '../../config.ts';
import type { AgentModelProvider } from '../contracts.ts';

export type ModelCatalogProviderId = Exclude<AgentModelProvider, 'openai-compatible'>;
export type AgentRuntimeModelProviderEntry = AgentRuntimeModels['providers'][number];

export interface ModelCatalogProvider {
    id: ModelCatalogProviderId;
    label: string;
}

export interface CuratedModel {
    capability?: AgentRuntimeModelCatalogEntry['capability'];
    executionKind?: AgentRuntimeModelCatalogEntry['executionKind'];
    label: string;
    modelId: string;
}

export interface ModelCatalogResult {
    models: AgentRuntimeModelCatalogEntry[];
    warning: null | string;
}

export interface ModelCatalogSource {
    provider: ModelCatalogProvider;
    resolveCatalog(): ModelCatalogResult | Promise<ModelCatalogResult>;
}

export function curatedCatalog(
    provider: ModelCatalogProvider,
    models: readonly CuratedModel[],
    input: {
        availability?: AgentRuntimeModelCatalogEntry['availability'];
        warning?: null | string;
    } = {}
): ModelCatalogResult {
    return {
        models: models.map((model) =>
            modelEntry({
                availability: input.availability,
                capability: model.capability,
                executionKind: model.executionKind,
                label: model.label,
                modelId: model.modelId,
                provider: provider.id,
            })
        ),
        warning: input.warning ?? null,
    };
}

export function mergeCuratedAndLive(
    provider: ModelCatalogProvider,
    curated: readonly CuratedModel[],
    liveModelIds: readonly string[],
    input: { liveFirst?: boolean; warning?: null | string } = {}
): ModelCatalogResult {
    const live = liveModelIds.map((modelId) => ({
        label: formatModelLabel(modelId),
        modelId,
    }));
    const primary = input.liveFirst ? live : curated;
    const secondary = input.liveFirst ? curated : live;
    const merged: CuratedModel[] = [];
    const seen = new Set<string>();

    for (const model of [...primary, ...secondary]) {
        const key = model.modelId.toLowerCase();
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        merged.push(model);
    }

    return curatedCatalog(provider, merged, { warning: input.warning });
}

export function providerEntry(
    provider: ModelCatalogProvider,
    input: Omit<AgentRuntimeModelProviderEntry, 'id' | 'label'>
): AgentRuntimeModelProviderEntry {
    return {
        ...input,
        id: provider.id,
        label: provider.label,
    };
}

export function sortModels(models: AgentRuntimeModelCatalogEntry[]) {
    return [...models].sort(
        (left, right) =>
            (left.provider ?? '').localeCompare(right.provider ?? '') ||
            (left.label ?? left.id).localeCompare(right.label ?? right.id) ||
            left.id.localeCompare(right.id)
    );
}

export function modelEntry(input: {
    availability?: AgentRuntimeModelCatalogEntry['availability'];
    capability?: AgentRuntimeModelCatalogEntry['capability'];
    executionKind?: AgentRuntimeModelCatalogEntry['executionKind'];
    label: string;
    modelId: string;
    provider: string;
    sourceKind?: AgentRuntimeModelCatalogEntry['sourceKind'];
}): AgentRuntimeModelCatalogEntry {
    return {
        availability: input.availability ?? 'available',
        capability: input.capability ?? 'agent',
        executionKind: input.executionKind ?? 'harness',
        id: `${input.provider}/${input.modelId}`,
        label: input.label,
        metadata: {},
        provider: input.provider,
        route: {
            baseUrl: null,
            model: input.modelId,
            provider: input.provider,
        },
        sourceKind: input.sourceKind ?? 'curated',
    };
}

export function formatModelLabel(modelId: string) {
    const parts = modelId
        .split(/[-_]/gu)
        .filter(Boolean)
        .reduce<string[]>((labelParts, part, index, parts) => {
            const next = parts[index + 1];
            if (next && /^\d$/u.test(part) && /^\d{1,2}$/u.test(next)) {
                labelParts.push(`${part}.${next}`);
                return labelParts;
            }
            const previous = parts[index - 1];
            if (previous && /^\d$/u.test(previous) && /^\d{1,2}$/u.test(part)) {
                return labelParts;
            }
            labelParts.push(part);
            return labelParts;
        }, []);

    return parts
        .map((part) => {
            if (/^gpt$/iu.test(part)) {
                return 'GPT';
            }
            return part.slice(0, 1).toUpperCase() + part.slice(1);
        })
        .join(' ');
}

export function parseOpenAiModelIds(input: unknown) {
    if (input === null || typeof input !== 'object' || !('data' in input)) {
        return [];
    }
    const data = (input as { data: unknown }).data;
    if (!Array.isArray(data)) {
        return [];
    }
    return data
        .map((model) => {
            if (model === null || typeof model !== 'object' || !('id' in model)) {
                return null;
            }
            const id = String((model as { id: unknown }).id).trim();
            return id || null;
        })
        .filter((modelId): modelId is string => Boolean(modelId));
}

export function openAiModelsUrl(baseURL: null | string | undefined) {
    const base = (baseURL?.trim() || 'https://api.openai.com/v1').replace(/\/+$/u, '');
    return base.endsWith('/v1') ? `${base}/models` : `${base}/v1/models`;
}

export function missingCliCatalogWarning(input: {
    command: string;
    provider: ModelCatalogProvider;
}) {
    const command = resolveCliCommand(input.command);
    if (command) {
        return null;
    }

    return missingCliCommandMessage({
        command: input.command,
        providerLabel: input.provider.label,
    });
}

export function errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
}

export function modelDiscoveryTimeoutMs() {
    const configured = Number(readConfigValue('TAVERN_AGENT_MODEL_DISCOVERY_TIMEOUT_MS'));
    if (Number.isFinite(configured) && configured > 0) {
        return configured;
    }
    return 1500;
}
