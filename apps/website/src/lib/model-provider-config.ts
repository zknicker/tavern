import type { IconSvgElement } from '@hugeicons/react';
import { Atom02Icon, ChatGptIcon, Globe02Icon } from '@hugeicons-pro/core-stroke-rounded';

export type ModelAccessId = 'codex' | 'openai' | 'openrouter';

export interface ModelProviderConfig {
    accessDisplayName: string;
    accessId: ModelAccessId | null;
    color: string;
    configName: string;
    displayName: string;
    icon: IconSvgElement;
}

export interface ModelIdentityConfig {
    displayName: string;
    modelId: string;
    provider: ModelProviderConfig;
    ref: string;
}

const configuredModelProviders = [
    {
        accessDisplayName: 'Codex',
        accessId: 'codex',
        color: '#3B82F6',
        configName: 'openai-codex',
        displayName: 'OpenAI Codex',
        icon: ChatGptIcon,
    },
    {
        accessDisplayName: 'OpenAI API',
        accessId: 'openai',
        color: '#10A37F',
        configName: 'openai',
        displayName: 'OpenAI',
        icon: ChatGptIcon,
    },
    {
        accessDisplayName: 'OpenRouter',
        accessId: 'openrouter',
        color: '#8B5CF6',
        configName: 'openrouter',
        displayName: 'OpenRouter',
        icon: Globe02Icon,
    },
] as const satisfies readonly ModelProviderConfig[];

const providerConfigByName = new Map<string, ModelProviderConfig>(
    configuredModelProviders.map((provider) => [provider.configName, provider] as const)
);

const providerConfigByAccessId = new Map<ModelAccessId, ModelProviderConfig>(
    configuredModelProviders.flatMap((provider) =>
        provider.accessId ? [[provider.accessId, provider] as const] : []
    )
);

export function getModelProviderConfig(providerId: string): ModelProviderConfig {
    return providerConfigByName.get(providerId) ?? createFallbackModelProvider(providerId);
}

export function getModelProviderConfigFromAccessId(accessId: ModelAccessId): ModelProviderConfig {
    return providerConfigByAccessId.get(accessId) ?? createFallbackModelProvider(accessId);
}

export function getModelIdentityConfig(input: {
    fallbackName?: string | null;
    modelId: string;
    providerId: string;
}): ModelIdentityConfig {
    const provider = getModelProviderConfig(input.providerId);
    const fallbackName = normalizeFallbackModelName(input.fallbackName, provider.displayName);

    return {
        displayName: fallbackName ?? input.modelId,
        modelId: input.modelId,
        provider,
        ref: input.providerId ? `${input.providerId}/${input.modelId}` : input.modelId,
    };
}

export function getModelIdentityConfigFromRef(modelRef: string, fallbackName?: string | null) {
    const { modelId, providerId } = splitModelRef(modelRef);

    return getModelIdentityConfig({
        fallbackName,
        modelId,
        providerId,
    });
}

export function formatModelOptionLabel(input: {
    fallbackName?: string | null;
    modelId: string;
    providerId: string;
}) {
    const model = getModelIdentityConfig(input);

    return model.displayName;
}

function createFallbackModelProvider(providerId: string): ModelProviderConfig {
    const label = titleizeIdentifier(providerId);

    return {
        accessDisplayName: label,
        accessId: null,
        color: '#64748B',
        configName: providerId,
        displayName: label,
        icon: Atom02Icon,
    };
}

function normalizeFallbackModelName(
    fallbackName: string | null | undefined,
    providerDisplayName: string
) {
    const normalizedName = fallbackName?.trim();

    if (!normalizedName) {
        return null;
    }

    return normalizeText(normalizedName) === normalizeText(providerDisplayName)
        ? null
        : normalizedName;
}

function splitModelRef(value: string) {
    const separatorIndex = value.indexOf('/');

    if (separatorIndex < 0) {
        return {
            modelId: value.trim(),
            providerId: '',
        };
    }

    return {
        modelId: value.slice(separatorIndex + 1).trim(),
        providerId: value.slice(0, separatorIndex).trim(),
    };
}

function normalizeText(value: string) {
    return value.trim().toLowerCase();
}

function titleizeIdentifier(value: string) {
    return value
        .trim()
        .split(/[-_/]+/g)
        .filter((segment) => segment.length > 0)
        .map((segment) => segment[0]?.toUpperCase() + segment.slice(1))
        .join(' ');
}
