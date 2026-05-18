import {
    type AgentRuntimeModelIdentity,
    type AgentRuntimeModelProviderId,
    type AgentRuntimeModels,
    agentRuntimeModelsSchema,
} from '@tavern/api';
import { asRecord, readArray, readString } from '../../gateway/records.ts';

export function mapOpenClawModels(input: unknown): AgentRuntimeModels {
    const record = asRecord(input);
    const configuredModels = readArray(record.models ?? record.items ?? input)
        .map(mapModelIdentity)
        .filter((model): model is AgentRuntimeModelIdentity => model !== null);
    const primaryModel = configuredModels[0] ?? null;

    return agentRuntimeModelsSchema.parse({
        agents: [],
        configuredModels,
        defaults: {
            fallbackModels: configuredModels.slice(1),
            primaryModel,
        },
        defaultsThinkingLevel: null,
        subAgentDefaultModel: null,
        subAgentThinkingLevel: null,
        updatedAt: null,
    });
}

export function normalizeOpenClawModelProvider(
    provider: string | null
): AgentRuntimeModelProviderId | null {
    if (!provider) {
        return null;
    }

    if (provider === 'anthropic' || provider === 'claude') {
        return 'claude';
    }

    if (provider === 'openai') {
        return 'codex';
    }

    if (provider === 'openrouter') {
        return 'openrouter';
    }

    return 'openrouter';
}

function mapModelIdentity(value: unknown): AgentRuntimeModelIdentity | null {
    const record = asRecord(value);
    const raw = typeof value === 'string' ? value : readString(record, ['id', 'model', 'name']);

    if (!raw) {
        return null;
    }

    const separatorIndex = raw.indexOf('/');
    const provider =
        separatorIndex > 0 ? raw.slice(0, separatorIndex) : readString(record, ['provider']);
    const modelId = separatorIndex > 0 ? raw.slice(separatorIndex + 1) : raw;

    return {
        modelId,
        provider: normalizeOpenClawModelProvider(provider) ?? 'openrouter',
    };
}
