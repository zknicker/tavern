import { createOpenAI } from '@ai-sdk/openai';
import type { AgentRuntimeModelName } from '@tavern/api';
import { readConfigValue } from '../config.ts';
import { getOpenAiApiKey } from '../model-access/openai-settings.ts';
import { resolveOpenRouterApiKey } from '../model-access/openrouter-settings.ts';

const openRouterBaseUrl = 'https://openrouter.ai/api/v1';

export async function createLanguageModelForRuntime(model: AgentRuntimeModelName) {
    switch (model.provider) {
        case 'openai':
            return createOpenAI({
                apiKey: readOpenAiApiKey(),
                ...(model.baseUrl ? { baseURL: model.baseUrl } : {}),
            })(model.model);
        case 'openai-compatible':
        case 'custom':
            return createOpenAI({
                apiKey: readOpenAiCompatibleApiKey(),
                baseURL: model.baseUrl ?? readRequiredConfigValue('TAVERN_AGENT_BASE_URL'),
            }).chat(model.model);
        case 'openrouter':
            return createOpenAI({
                apiKey: await readOpenRouterApiKey(),
                baseURL: model.baseUrl ?? openRouterBaseUrl,
            }).chat(model.model);
        default:
            throw new Error(
                `Memory dreaming cannot use provider "${model.provider}" without a direct LanguageModel adapter.`
            );
    }
}

export function supportsLanguageModelForRuntime(model: AgentRuntimeModelName) {
    return ['custom', 'openai', 'openai-compatible', 'openrouter'].includes(model.provider);
}

function readOpenAiApiKey() {
    const apiKey =
        readConfigValue('TAVERN_AGENT_API_KEY') ??
        readConfigValue('OPENAI_API_KEY') ??
        getOpenAiApiKey();
    if (!apiKey) {
        throw new Error('OPENAI_API_KEY or TAVERN_AGENT_API_KEY is required for Memory dreaming.');
    }
    return apiKey;
}

async function readOpenRouterApiKey() {
    const apiKey = await resolveOpenRouterApiKey();
    if (!apiKey) {
        throw new Error('OPENROUTER_API_KEY is required for Memory dreaming.');
    }
    return apiKey;
}

function readOpenAiCompatibleApiKey() {
    return (
        readConfigValue('TAVERN_AGENT_API_KEY') ??
        readConfigValue('OPENAI_API_KEY') ??
        'tavern-local'
    );
}

function readRequiredConfigValue(name: string) {
    const value = readConfigValue(name);
    if (!value) {
        throw new Error(`${name} is required for Memory dreaming.`);
    }
    return value;
}
