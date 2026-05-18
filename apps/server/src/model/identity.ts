import { agentRuntimeModelProviderIdSchema } from '@tavern/api';
import { z } from 'zod';

export const normalizedModelSchema = z.object({
    label: z.string().min(1),
    model: z.string().min(1),
    provider: agentRuntimeModelProviderIdSchema,
});

export type NormalizedModel = z.infer<typeof normalizedModelSchema>;

function normalizeLabel(value: string) {
    const trimmed = value.trim();

    if (trimmed.length === 0) {
        return null;
    }

    const slashCandidate = trimmed
        .split('/')
        .filter((segment) => segment.length > 0)
        .at(-1);
    const colonCandidate = (slashCandidate ?? trimmed)
        .split(':')
        .filter((segment) => segment.length > 0)
        .at(-1);

    return colonCandidate?.trim() ?? null;
}

function normalizeModel(value: string, provider: string) {
    const trimmed = value.trim();

    if (trimmed.length === 0) {
        return null;
    }

    const providerPrefix = `${provider}/`;
    const withoutProviderPrefix = trimmed.startsWith(providerPrefix)
        ? trimmed.slice(providerPrefix.length).trim()
        : trimmed;

    return withoutProviderPrefix.length > 0 ? withoutProviderPrefix : null;
}

function readRequiredModelIdentityValue(value: string | null | undefined, label: string) {
    const trimmed = value?.trim() ?? '';

    if (trimmed.length === 0) {
        throw new Error(`Model identity requires a ${label}.`);
    }

    return trimmed;
}

export function normalizeModelIdentity(input: {
    model?: string | null;
    provider?: string | null;
}): NormalizedModel | undefined {
    if (!(input.model || input.provider)) {
        return undefined;
    }

    const provider = agentRuntimeModelProviderIdSchema.parse(
        readRequiredModelIdentityValue(input.provider, 'provider')
    );
    const model = normalizeModel(readRequiredModelIdentityValue(input.model, 'model'), provider);

    if (!model) {
        throw new Error('Model identity requires a model.');
    }

    return normalizedModelSchema.parse({
        label: normalizeLabel(model) ?? model,
        model,
        provider,
    });
}
