import * as z from 'zod';
import type { ModelProviderId } from './inventory-contracts.ts';

export const openClawHarnessSchema = z.enum(['pi', 'codex']);
export type OpenClawHarness = z.infer<typeof openClawHarnessSchema>;

export interface TavernModelDefinition {
    contextWindow: number | null;
    displayName: string;
    modelId: string;
    provider: ModelProviderId;
}

export interface OpenClawModelNameDefinition {
    harness: OpenClawHarness;
    isPreferred: boolean;
    modelCatalogId: string;
    openClawModel: string;
    openClawProvider: string;
}

export interface CanonicalOpenClawModel {
    modelCatalogId: string;
    modelId: string;
    openClawHarness: OpenClawHarness | null;
    openClawModel: string;
    openClawModelNameId: string | null;
    openClawProvider: string;
    provider: ModelProviderId;
}

export const tavernModelCatalog: TavernModelDefinition[] = [
    createModel('claude', 'claude-opus-4-7', 'Claude Opus 4.7', 1_000_000),
    createModel('claude', 'claude-sonnet-4-6', 'Claude Sonnet 4.6', 1_000_000),
    createModel('claude', 'claude-haiku-4-5-20251001', 'Claude Haiku 4.5', 200_000),
    createModel('codex', 'gpt-5.5', 'GPT-5.5', 400_000),
    createModel('codex', 'gpt-5.4', 'GPT-5.4', null),
    createModel('codex', 'gpt-5.4-mini', 'GPT-5.4 Mini', null),
    createModel('codex', 'gpt-5.3-codex', 'GPT-5.3 Codex', null),
    createModel('codex', 'gpt-5.3-codex-spark', 'GPT-5.3 Codex Spark', null),
    createModel('codex', 'gpt-5.2', 'GPT-5.2', null),
    createModel('openrouter', 'moonshotai/kimi-k2.5', 'Kimi K2.5', 262_144),
];

export const openClawModelNames: OpenClawModelNameDefinition[] = [
    ...tavernModelCatalog.flatMap((model) => {
        if (model.provider !== 'codex') {
            return [];
        }

        return [
            createOpenClawModelName({
                harness: 'codex',
                isPreferred: true,
                modelCatalogId: formatTavernModelId(model),
                openClawModel: model.modelId,
                openClawProvider: 'openai',
            }),
        ];
    }),
    ...tavernModelCatalog.flatMap((model) => {
        if (model.provider !== 'claude') {
            return [];
        }

        return [
            createOpenClawModelName({
                harness: 'pi',
                isPreferred: true,
                modelCatalogId: formatTavernModelId(model),
                openClawModel: model.modelId,
                openClawProvider: 'anthropic',
            }),
        ];
    }),
    ...tavernModelCatalog.flatMap((model) => {
        if (model.provider !== 'openrouter') {
            return [];
        }

        return [
            createOpenClawModelName({
                harness: 'pi',
                isPreferred: true,
                modelCatalogId: formatTavernModelId(model),
                openClawModel: model.modelId,
                openClawProvider: 'openrouter',
            }),
        ];
    }),
];

const openClawNameByRawName = new Map(
    openClawModelNames.map((name) => [
        formatOpenClawModelNameKey({
            harness: name.harness,
            model: name.openClawModel,
            provider: name.openClawProvider,
        }),
        name,
    ])
);

export function formatTavernModelId(model: Pick<TavernModelDefinition, 'modelId' | 'provider'>) {
    return `${model.provider}/${model.modelId}`;
}

export function formatOpenClawModelNameId(input: {
    harness: OpenClawHarness;
    model: string;
    provider: string;
}) {
    return `${input.harness}:${input.provider}/${input.model}`;
}

export function formatOpenClawModelName(input: { model: string; provider: string }) {
    return `${input.provider}/${input.model}`;
}

export function getOpenClawModelName(id: string) {
    return openClawModelNames.find((name) => formatOpenClawModelNameDefinitionId(name) === id);
}

export function getPreferredOpenClawModelName(input: {
    harness: OpenClawHarness;
    modelCatalogId: string;
}) {
    return (
        openClawModelNames.find(
            (name) =>
                name.harness === input.harness &&
                name.modelCatalogId === input.modelCatalogId &&
                name.isPreferred
        ) ??
        openClawModelNames.find(
            (name) => name.harness === input.harness && name.modelCatalogId === input.modelCatalogId
        ) ??
        null
    );
}

export function listOpenClawModelNamesForHarness(harness: OpenClawHarness) {
    return openClawModelNames.filter((name) => name.harness === harness);
}

export function normalizeOpenClawModelIdentity(input: {
    harness?: OpenClawHarness | null;
    model: string | null;
    provider: string | null;
}): CanonicalOpenClawModel | null {
    const rawProvider = input.provider?.trim() ?? '';
    const rawModel = input.model?.trim() ?? '';

    if (!(rawProvider && rawModel)) {
        return null;
    }

    const harnesses: Array<OpenClawHarness | null> = input.harness
        ? [input.harness]
        : ['codex', 'pi', null];

    for (const harness of harnesses) {
        const mapped = harness
            ? openClawNameByRawName.get(
                  formatOpenClawModelNameKey({
                      harness,
                      model: rawModel,
                      provider: rawProvider,
                  })
              )
            : null;

        if (mapped) {
            return toCanonicalOpenClawModel(mapped);
        }
    }

    if (rawProvider === 'openrouter') {
        return createDynamicCanonicalModel({
            modelId: rawModel,
            provider: 'openrouter',
            rawModel,
            rawProvider,
        });
    }

    if (rawProvider === 'anthropic') {
        return createDynamicCanonicalModel({
            modelId: rawModel,
            provider: 'claude',
            rawModel,
            rawProvider,
        });
    }

    if (rawProvider === 'openai') {
        return createDynamicCanonicalModel({
            modelId: rawModel,
            provider: 'codex',
            rawModel,
            rawProvider,
        });
    }

    return null;
}

export function formatOpenClawModelNameDefinitionId(name: OpenClawModelNameDefinition) {
    return formatOpenClawModelNameId({
        harness: name.harness,
        model: name.openClawModel,
        provider: name.openClawProvider,
    });
}

function createModel(
    provider: ModelProviderId,
    modelId: string,
    displayName: string,
    contextWindow: number | null
): TavernModelDefinition {
    return {
        contextWindow,
        displayName,
        modelId,
        provider,
    };
}

function createOpenClawModelName(input: OpenClawModelNameDefinition) {
    return input;
}

function toCanonicalOpenClawModel(mapped: OpenClawModelNameDefinition): CanonicalOpenClawModel {
    const [provider, modelId] = mapped.modelCatalogId.split('/', 2) as [ModelProviderId, string];

    return {
        modelCatalogId: mapped.modelCatalogId,
        modelId,
        openClawHarness: mapped.harness,
        openClawModel: mapped.openClawModel,
        openClawModelNameId: formatOpenClawModelNameDefinitionId(mapped),
        openClawProvider: mapped.openClawProvider,
        provider,
    };
}

function createDynamicCanonicalModel(input: {
    modelId: string;
    provider: ModelProviderId;
    rawModel: string;
    rawProvider: string;
}): CanonicalOpenClawModel {
    const modelCatalogId = `${input.provider}/${input.modelId}`;

    return {
        modelCatalogId,
        modelId: input.modelId,
        openClawHarness: null,
        openClawModel: input.rawModel,
        openClawModelNameId: null,
        openClawProvider: input.rawProvider,
        provider: input.provider,
    };
}

function formatOpenClawModelNameKey(input: {
    harness: OpenClawHarness;
    model: string;
    provider: string;
}) {
    return `${input.harness}:${input.provider}/${input.model}`;
}
