import { createOpenAI } from '@ai-sdk/openai';
import type { AgentRuntimeModelName } from '@tavern/api';
import type { ImageModel } from 'ai';
import { readConfigValue } from '../config.ts';
import { getOpenAiApiKey } from '../model-access/openai-settings.ts';

export const imageGenerationMissingKeyReason =
    'OPENAI_API_KEY or TAVERN_AGENT_API_KEY is required for image generation.';

export function createImageModelForRuntime(model: AgentRuntimeModelName): ImageModel {
    if (!supportsImageModelForRuntime(model)) {
        throw new Error(unsupportedImageModelProviderReason(model.provider));
    }

    const apiKey = resolveImageGenerationApiKey();
    if (!apiKey) {
        throw new Error(imageGenerationMissingKeyReason);
    }

    return createOpenAI({ apiKey }).image(model.model);
}

export function supportsImageModelForRuntime(model: AgentRuntimeModelName) {
    return model.provider === 'openai';
}

export function resolveImageGenerationApiKey() {
    return (
        readConfigValue('TAVERN_AGENT_API_KEY') ??
        readConfigValue('OPENAI_API_KEY') ??
        getOpenAiApiKey()
    );
}

export function unsupportedImageModelProviderReason(provider: string) {
    return `Image generation cannot use provider "${provider}" without a direct image model adapter.`;
}
