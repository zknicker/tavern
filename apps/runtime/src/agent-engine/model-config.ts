import { createOpenAI } from '@ai-sdk/openai';
import type { AgentRuntimeModelName } from '@tavern/api';
import type { LanguageModel, ToolSet } from 'ai';
import { readConfigValue } from '../config.ts';
import {
    type AgentModelProvider,
    defaultE2eModel,
    isAgentModelProvider,
} from '../models/contracts.ts';
import {
    resolveAgentModelSelection,
    resolveConfiguredProvider,
} from '../models/selection-service.ts';
import { resolveCliCommand } from './cli-command.ts';
import { defaultAgentEngineAgentId } from './constants.ts';
import { createE2eLanguageModel } from './e2e-model.ts';

export interface AgentLanguageModelConfig {
    model: LanguageModel;
    modelId: string;
    provider: AgentModelProvider;
    wrapTools<TTools extends ToolSet>(tools: TTools): TTools;
}

export async function resolveAgentLanguageModelConfig(
    input: { agentId?: string; modelName?: AgentRuntimeModelName } = {}
): Promise<AgentLanguageModelConfig> {
    const selected =
        input.modelName ??
        resolveAgentModelSelection({
            agentId: input.agentId ?? defaultAgentEngineAgentId,
        });
    const provider = isAgentModelProvider(selected.provider)
        ? selected.provider
        : resolveConfiguredProvider();

    if (provider === 'codex') {
        throw new Error('Codex models execute through the harness executor, not LanguageModel.');
    }

    if (provider === 'claude') {
        throw new Error(
            'Claude Code models execute through the harness executor, not LanguageModel.'
        );
    }

    if (provider === 'e2e') {
        const modelId = selected.model || readConfigValue('TAVERN_AGENT_MODEL') || defaultE2eModel;

        return {
            model: createE2eLanguageModel(modelId) as unknown as LanguageModel,
            modelId,
            provider,
            wrapTools: (tools) => tools,
        };
    }

    return resolveOpenAiModel(provider, selected.model);
}

export function resolveAgentModelSummary() {
    return resolveAgentModelSelection({ agentId: defaultAgentEngineAgentId });
}

export function hasConfiguredAgentModelAccess() {
    const provider = resolveConfiguredProvider();

    if (provider === 'openai') {
        return Boolean(
            readConfigValue('OPENAI_API_KEY') ?? readConfigValue('TAVERN_AGENT_API_KEY')
        );
    }
    if (provider === 'openai-compatible') {
        return Boolean(readConfigValue('TAVERN_AGENT_BASE_URL'));
    }
    if (provider === 'claude') {
        return Boolean(
            resolveCliCommand(readConfigValue('TAVERN_AGENT_CLAUDE_CODE_COMMAND') ?? 'claude')
        );
    }
    if (provider === 'codex') {
        return Boolean(
            resolveCliCommand(readConfigValue('TAVERN_AGENT_CODEX_CLI_COMMAND') ?? 'codex')
        );
    }
    return true;
}

function resolveOpenAiModel(
    provider: 'openai' | 'openai-compatible',
    selectedModelId: string
): AgentLanguageModelConfig {
    const baseURL =
        provider === 'openai-compatible' ? readConfigValue('TAVERN_AGENT_BASE_URL') : undefined;
    const apiKey =
        readConfigValue('TAVERN_AGENT_API_KEY') ??
        (provider === 'openai-compatible' ? null : readConfigValue('OPENAI_API_KEY')) ??
        'tavern-local';
    const modelId = selectedModelId;
    const openai = createOpenAI({
        apiKey,
        ...(baseURL ? { baseURL } : {}),
        name: provider,
    });

    return {
        model: openai.chat(modelId),
        modelId,
        provider,
        wrapTools: (tools) => tools,
    };
}
