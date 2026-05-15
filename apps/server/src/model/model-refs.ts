import {
    type AgentRuntimeModelIdentity,
    formatAgentRuntimeModelRef,
    parseAgentRuntimeModelRef,
} from '@tavern/agent-runtime-protocol';

export interface ModelRefSelection {
    fallbackModels: string[];
    primaryModel: string | null;
}

export function formatModelRef(model: AgentRuntimeModelIdentity): string;
export function formatModelRef(model: AgentRuntimeModelIdentity | null | undefined): string | null;
export function formatModelRef(model: AgentRuntimeModelIdentity | null | undefined): string | null {
    return model ? formatAgentRuntimeModelRef(model) : null;
}

export function formatModelRefs(models: AgentRuntimeModelIdentity[]) {
    return models.map((model) => formatAgentRuntimeModelRef(model));
}

export function parseModelRef(modelRef: string) {
    return parseAgentRuntimeModelRef(modelRef);
}

export function parseModelRefs(modelRefs: string[]) {
    return modelRefs.map((modelRef) => parseAgentRuntimeModelRef(modelRef));
}

export function formatModelSelection(input: {
    fallbackModels: AgentRuntimeModelIdentity[];
    primaryModel: AgentRuntimeModelIdentity | null;
}): ModelRefSelection {
    return {
        fallbackModels: formatModelRefs(input.fallbackModels),
        primaryModel: formatModelRef(input.primaryModel),
    };
}

export function parseModelSelection(input: ModelRefSelection) {
    return {
        fallbackModels: parseModelRefs(input.fallbackModels),
        primaryModel: input.primaryModel ? parseAgentRuntimeModelRef(input.primaryModel) : null,
    };
}
