import type { AgentRuntimeModelName } from '@tavern/api';
import { isCliCommandAvailable } from '../agent-engine/cli-command.ts';
import { readConfigValue } from '../config.ts';
import type { Database } from '../db/sqlite.ts';
import { getOpenAiApiKey } from '../model-access/openai-settings.ts';
import { getOpenRouterApiKey } from '../model-access/openrouter-settings.ts';
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

const directWorkerProviders = new Set(['openai', 'openai-compatible', 'openrouter', 'custom']);
const defaultOpenRouterWorkerModel = 'openai/gpt-4.1-mini';

/**
 * Memory background work runs as direct model calls, so its Automatic
 * cannot follow a harness provider. Use the agent default when it is already
 * direct; otherwise fall back to whichever direct connection is configured.
 */
export function defaultWorkerModelSelection(): AgentRuntimeModelName {
    const agentDefault = defaultAgentModelSelection();
    if (directWorkerProviders.has(agentDefault.provider)) {
        return agentDefault;
    }
    if (hasOpenAiAccessConfig() || getOpenAiApiKey()) {
        return {
            model: readConfigValue('TAVERN_AGENT_OPENAI_MODEL') ?? defaultOpenAiModel,
            provider: 'openai',
        };
    }
    if (readConfigValue('OPENROUTER_API_KEY') ?? getOpenRouterApiKey()) {
        return { model: defaultOpenRouterWorkerModel, provider: 'openrouter' };
    }
    // Nothing direct is configured; report the agent default so the
    // Memory extraction/dreaming capabilities explain what is missing.
    return agentDefault;
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
    if (hasOpenAiAccessConfig()) {
        return 'openai';
    }
    if (isCliCommandAvailable(readConfigValue('TAVERN_AGENT_CODEX_CLI_COMMAND') ?? 'codex')) {
        return 'codex';
    }
    if (isCliCommandAvailable(readConfigValue('TAVERN_AGENT_CLAUDE_CODE_COMMAND') ?? 'claude')) {
        return 'claude';
    }
    return 'openai';
}

function hasOpenAiAccessConfig() {
    return Boolean(
        readConfigValue('OPENAI_API_KEY') ??
            readConfigValue('TAVERN_AGENT_API_KEY') ??
            readConfigValue('AI_GATEWAY_API_KEY') ??
            readConfigValue('VERCEL_OIDC_TOKEN')
    );
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
