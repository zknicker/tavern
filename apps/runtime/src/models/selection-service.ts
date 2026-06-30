import type { AgentRuntimeModelName } from '@tavern/api';
import { readConfigValue } from '../config.ts';
import type { Database } from '../db/sqlite.ts';
import {
    type AgentModelProvider,
    defaultClaudeModel,
    defaultCodexModel,
    defaultOpenAiModel,
    isAgentModelProvider,
} from './contracts.ts';
import { readAgentRuntimeProfile, saveAgentRuntimeProfile } from './runtime-profile-store.ts';
import { readAgentModelSelection, saveAgentModelSelection } from './selection-store.ts';

export function resolveAgentModelSelection(input: { agentId: string; db?: Database }) {
    const profile = readAgentRuntimeProfile(input.agentId, input.db);
    const saved = readAgentModelSelection(input.agentId, input.db);
    return profile?.defaultModel ?? saved?.modelName ?? defaultAgentModelSelection();
}

export function saveAgentModelSelectionIntent(input: {
    agentId: string;
    db?: Database;
    modelName: AgentRuntimeModelName;
}) {
    if (!(isAgentModelProvider(input.modelName.provider) && input.modelName.model.trim())) {
        throw new Error(
            `Unsupported agent model "${input.modelName.provider}/${input.modelName.model}".`
        );
    }

    const profile = saveAgentRuntimeProfile({
        agentId: input.agentId,
        db: input.db,
        defaultModel: input.modelName,
    });
    saveAgentModelSelection({
        agentId: input.agentId,
        db: input.db,
        modelName: input.modelName,
        status: 'unknown',
    });
    return profile;
}

export function defaultAgentModelSelection(): AgentRuntimeModelName {
    const provider = resolveConfiguredProvider();
    return {
        model:
            modelForProvider(provider) ??
            readConfigValue('TAVERN_AGENT_MODEL') ??
            (provider === 'openai' ? readConfigValue('TAVERN_AGENT_OPENAI_MODEL') : null) ??
            defaultModelForProvider(provider),
        provider,
    };
}

export function resolveConfiguredProvider(): AgentModelProvider {
    const configured =
        readConfigValue('TAVERN_AGENT_PROVIDER') ?? readConfigValue('TAVERN_AGENT_MODEL_PROVIDER');

    if (configured === 'codex' || configured === 'claude' || configured === 'openai') {
        return configured;
    }
    if (configured === 'custom' || configured === 'openai-compatible') {
        return 'openai-compatible';
    }
    if (readConfigValue('TAVERN_AGENT_BASE_URL')) {
        return 'openai-compatible';
    }
    return 'openai';
}

function modelForProvider(provider: AgentModelProvider) {
    if (provider === 'codex') {
        return readConfigValue('TAVERN_AGENT_CODEX_MODEL');
    }
    if (provider === 'claude') {
        return readConfigValue('TAVERN_AGENT_CLAUDE_MODEL');
    }
    return null;
}

function defaultModelForProvider(provider: AgentModelProvider) {
    switch (provider) {
        case 'claude':
            return defaultClaudeModel;
        case 'codex':
            return defaultCodexModel;
        case 'openai':
        case 'openai-compatible':
            return defaultOpenAiModel;
    }
}
