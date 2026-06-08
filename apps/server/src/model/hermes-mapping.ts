import * as z from 'zod';

export const hermesHarnessSchema = z.enum(['pi', 'codex']);
export type HermesHarness = z.infer<typeof hermesHarnessSchema>;

export interface CanonicalHermesModel {
    hermesHarness: HermesHarness;
    hermesModel: string;
    hermesModelNameId: string;
    hermesProvider: string;
    modelCatalogId: string;
    modelId: string;
    provider: string;
}

export function formatHermesModelNameId(input: { model: string; provider: string }) {
    return formatHermesModelName(input);
}

export function formatHermesModelName(input: { model: string; provider: string }) {
    return `${input.provider}/${input.model}`;
}

export function parseHermesModelRef(value: string) {
    const trimmed = value.trim();
    const separatorIndex = trimmed.indexOf('/');

    if (separatorIndex <= 0 || separatorIndex === trimmed.length - 1) {
        throw new Error(`Invalid Hermes model ref "${value}". Expected "<provider>/<model>".`);
    }

    return {
        model: trimmed.slice(separatorIndex + 1).trim(),
        provider: trimmed.slice(0, separatorIndex).trim(),
    };
}

export function inferHermesHarness(provider: string): HermesHarness {
    return provider.trim().toLowerCase() === 'openai-codex' ? 'codex' : 'pi';
}

export function normalizeHermesModelIdentity(input: {
    harness?: HermesHarness | null;
    model: string | null;
    provider: string | null;
}): CanonicalHermesModel | null {
    const provider = input.provider?.trim() ?? '';
    const model = input.model?.trim() ?? '';

    if (!(provider && model)) {
        return null;
    }

    return {
        hermesHarness: input.harness ?? inferHermesHarness(provider),
        hermesModel: model,
        hermesModelNameId: formatHermesModelNameId({ model, provider }),
        hermesProvider: provider,
        modelCatalogId: formatHermesModelName({ model, provider }),
        modelId: model,
        provider,
    };
}
