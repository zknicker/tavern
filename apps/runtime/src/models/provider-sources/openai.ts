import {
    modelCatalogExpiry,
    modelCatalogFingerprint,
    readCachedModelCatalog,
    writeCachedModelCatalog,
} from '../catalog-store.ts';
import { curatedOpenAiImageModels, curatedOpenAiModels } from '../curated/openai.ts';
import {
    curatedCatalog,
    errorMessage,
    type ModelCatalogProvider,
    type ModelCatalogResult,
    mergeCuratedAndLive,
    openAiModelsUrl,
    parseOpenAiModelIds,
} from './shared.ts';

const curatedOpenAiCatalog = [...curatedOpenAiModels, ...curatedOpenAiImageModels];

export async function resolveOpenAiModelCatalog(input: {
    apiKey: null | string;
    baseURL?: null | string;
    provider: ModelCatalogProvider;
}): Promise<ModelCatalogResult> {
    if (!input.apiKey) {
        return {
            models: [],
            warning: 'OPENAI_API_KEY or TAVERN_AGENT_API_KEY is not set.',
        };
    }

    const fingerprint = modelCatalogFingerprint([input.apiKey, input.baseURL]);
    const cached = readCachedModelCatalog({
        fingerprint,
        providerId: input.provider.id,
    });
    if (cached) {
        return fromOpenAiLiveIds(input.provider, cached.models, cached.warning);
    }

    try {
        const response = await fetch(openAiModelsUrl(input.baseURL), {
            headers: {
                Authorization: `Bearer ${input.apiKey}`,
            },
        });
        if (!response.ok) {
            return mergeCuratedAndLive(input.provider, curatedOpenAiCatalog, [], {
                warning:
                    `OpenAI model discovery failed: ${response.status} ${response.statusText}`.trim(),
            });
        }

        const liveModelIds = parseOpenAiModelIds(await response.json());
        writeCachedModelCatalog({
            expiresAt: modelCatalogExpiry(60 * 60 * 1000),
            fingerprint,
            models: liveModelIds,
            providerId: input.provider.id,
            sourceKind: 'openai-models-api',
        });

        return fromOpenAiLiveIds(input.provider, liveModelIds);
    } catch (error) {
        const stale = readCachedModelCatalog({
            allowExpired: true,
            fingerprint,
            providerId: input.provider.id,
        });
        if (stale) {
            return fromOpenAiLiveIds(
                input.provider,
                stale.models,
                `OpenAI model discovery failed; using cached catalog: ${errorMessage(error)}`
            );
        }

        return mergeCuratedAndLive(input.provider, curatedOpenAiCatalog, [], {
            warning: `OpenAI model discovery failed: ${errorMessage(error)}`,
        });
    }
}

function fromOpenAiLiveIds(
    provider: ModelCatalogProvider,
    liveModelIds: readonly string[],
    warning: null | string = null
) {
    const live = new Set(liveModelIds.map((modelId) => modelId.toLowerCase()));
    const curatedAvailable = curatedOpenAiCatalog.filter((model) =>
        live.has(model.modelId.toLowerCase())
    );

    return curatedAvailable.length > 0
        ? curatedCatalog(provider, curatedAvailable, { warning })
        : mergeCuratedAndLive(provider, curatedOpenAiCatalog, [], {
              warning: warning ?? 'OpenAI did not return any curated models.',
          });
}
