import { curatedCatalog, type ModelCatalogProvider, type ModelCatalogResult } from './shared.ts';

/**
 * Kimi Code (subscription) models, served by the pi harness against
 * api.kimi.com/coding with the runtime's OAuth bearer. The catalog is
 * curated: the endpoint has no model-listing API, and the definitions below
 * mirror pi's upstream kimi-coding registry (pi-ai 0.80.x) — our pinned pi
 * predates K3, so the executor registers these definitions itself through
 * the harness customEnv (see harness-agent-executor.ts).
 */

export function resolveKimiModelCatalog(provider: ModelCatalogProvider): ModelCatalogResult {
    return curatedCatalog(
        provider,
        kimiCodingModelDefinitions.map((model) => ({
            label: model.name,
            modelId: model.id,
        }))
    );
}

/**
 * Pi `registerProvider` model definitions, mirrored from pi-ai 0.80.10's
 * built-in kimi-coding provider. Serialized into the harness customEnv as
 * KIMI_CODING_MODELS_JSON so the pinned pi (0.79.x registry, no K3) still
 * runs current Kimi Code models. Costs are zero: subscription-covered.
 */
export const kimiCodingModelDefinitions = [
    {
        api: 'anthropic-messages',
        compat: { allowEmptySignature: true, forceAdaptiveThinking: true },
        contextWindow: 1_048_576,
        cost: { cacheRead: 0, cacheWrite: 0, input: 0, output: 0 },
        headers: { 'User-Agent': 'KimiCLI/1.5' },
        id: 'k3',
        input: ['text', 'image'],
        maxTokens: 131_072,
        name: 'Kimi K3',
        reasoning: true,
        thinkingLevelMap: {
            high: null,
            low: null,
            max: 'max',
            medium: null,
            minimal: null,
            off: null,
            xhigh: null,
        },
    },
    {
        api: 'anthropic-messages',
        compat: { forceAdaptiveThinking: true },
        contextWindow: 262_144,
        cost: { cacheRead: 0, cacheWrite: 0, input: 0, output: 0 },
        headers: { 'User-Agent': 'KimiCLI/1.5' },
        id: 'kimi-for-coding',
        input: ['text', 'image'],
        maxTokens: 32_768,
        name: 'Kimi For Coding',
        reasoning: true,
    },
    {
        api: 'anthropic-messages',
        compat: { forceAdaptiveThinking: true },
        contextWindow: 262_144,
        cost: { cacheRead: 0, cacheWrite: 0, input: 0, output: 0 },
        headers: { 'User-Agent': 'KimiCLI/1.5' },
        id: 'kimi-k2-thinking',
        input: ['text'],
        maxTokens: 32_768,
        name: 'Kimi K2 Thinking',
        reasoning: true,
    },
] as const;

export const kimiCodingBaseUrl = 'https://api.kimi.com/coding';
