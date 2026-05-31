import {
    type AgentRuntimeModelCatalogEntry,
    type AgentRuntimeModelProviderId,
    type AgentRuntimeModels,
    agentRuntimeModelsSchema,
} from '@tavern/api';
import { asRecord, readArray, readString } from '../../gateway/records.ts';

export function mapOpenClawModels(input: unknown): AgentRuntimeModels {
    const record = asRecord(input);
    const models = readArray(record.models ?? record.items ?? input)
        .map(mapModelCatalogEntry)
        .filter((model): model is AgentRuntimeModelCatalogEntry => model !== null);

    return agentRuntimeModelsSchema.parse({
        models,
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

function mapModelCatalogEntry(value: unknown) {
    const record = asRecord(value);
    const id = typeof value === 'string' ? value : readString(record, ['id', 'model', 'name']);

    if (!id) {
        return null;
    }

    const separatorIndex = id.indexOf('/');
    const provider =
        readString(record, ['provider']) ??
        (separatorIndex > 0 ? id.slice(0, separatorIndex) : null);

    return {
        id,
        label: readString(record, ['label', 'name']),
        provider,
    };
}
