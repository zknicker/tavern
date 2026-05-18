import {
    type AgentRuntimeModelProviderId,
    agentRuntimeModelProviderCapabilities,
    parseAgentRuntimeModelRef,
} from '@tavern/api';
import type { Model } from './contracts.ts';
import {
    formatOpenClawModelName,
    formatOpenClawModelNameDefinitionId,
    openClawModelNames,
} from './openclaw-mapping.ts';

const modelCatalog = [
    ['claude', 'claude-opus-4-7', 'Claude Opus 4.7'],
    ['claude', 'claude-sonnet-4-6', 'Claude Sonnet 4.6'],
    ['claude', 'claude-haiku-4-5-20251001', 'Claude Haiku 4.5'],
    ['codex', 'gpt-5.5', 'GPT-5.5'],
    ['codex', 'gpt-5.4', 'GPT-5.4'],
    ['codex', 'gpt-5.4-mini', 'GPT-5.4 Mini'],
    ['codex', 'gpt-5.3-codex', 'GPT-5.3 Codex'],
    ['codex', 'gpt-5.3-codex-spark', 'GPT-5.3 Codex Spark'],
    ['codex', 'gpt-5.2', 'GPT-5.2'],
    ['openrouter', 'moonshotai/kimi-k2.5', 'Kimi K2.5'],
] as const;

function createModel(input: {
    availability: Model['availability'];
    contextWindow?: number | null;
    modelId: string;
    name: string;
    provider: AgentRuntimeModelProviderId;
}) {
    const ref = `${input.provider}/${input.modelId}`;

    return {
        availability: input.availability,
        contextWindow: input.contextWindow ?? null,
        framework: 'tavern',
        id: ref,
        modelId: input.modelId,
        name: input.name,
        openClawNames: openClawModelNames
            .filter((name) => name.modelCatalogId === ref)
            .map((name) => ({
                available: true,
                harness: name.harness,
                id: formatOpenClawModelNameDefinitionId(name),
                isPreferred: name.isPreferred,
                label: formatOpenClawModelName({
                    model: name.openClawModel,
                    provider: name.openClawProvider,
                }),
                model: name.openClawModel,
                provider: name.openClawProvider,
            })),
        provider: input.provider,
        ref,
        reasoning: null,
        supportsChatRouting:
            agentRuntimeModelProviderCapabilities[input.provider].supportsChatRouting,
    } satisfies Model;
}

export function listCatalogModels() {
    return modelCatalog.map(([provider, modelId, name]) =>
        createModel({
            availability: 'available',
            modelId,
            name,
            provider,
        })
    );
}

export function createConfiguredModel(input: {
    contextWindow?: number | null;
    modelRef: string;
    name?: string | null;
}) {
    const { contextWindow = null, modelRef } = input;
    const { modelId, provider } = parseAgentRuntimeModelRef(modelRef);
    const fallbackName = input.name?.trim() || null;

    return createModel({
        availability: 'configured',
        contextWindow,
        modelId,
        name: fallbackName ?? modelId,
        provider,
    });
}
