export interface CanonicalAgentModel {
    agentModel: string;
    agentModelNameId: string;
    agentProvider: string;
    modelId: string;
    modelRef: string;
    provider: string;
}

export function formatAgentModelNameId(input: { model: string; provider: string }) {
    return formatAgentModelName(input);
}

export function formatAgentModelName(input: { model: string; provider: string }) {
    return `${input.provider}/${input.model}`;
}

export function parseAgentModelRef(value: string) {
    const trimmed = value.trim();
    const separatorIndex = trimmed.indexOf('/');

    if (separatorIndex <= 0 || separatorIndex === trimmed.length - 1) {
        throw new Error(`Invalid agent model ref "${value}". Expected "<provider>/<model>".`);
    }

    return {
        model: trimmed.slice(separatorIndex + 1).trim(),
        provider: trimmed.slice(0, separatorIndex).trim(),
    };
}

export function normalizeAgentModelIdentity(input: {
    model: string | null;
    provider: string | null;
}): CanonicalAgentModel | null {
    const provider = input.provider?.trim() ?? '';
    const model = input.model?.trim() ?? '';

    if (!(provider && model)) {
        return null;
    }

    return {
        agentModel: model,
        agentModelNameId: formatAgentModelNameId({ model, provider }),
        agentProvider: provider,
        modelId: model,
        modelRef: formatAgentModelName({ model, provider }),
        provider,
    };
}
