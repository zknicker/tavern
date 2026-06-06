import { expect, test } from 'bun:test';
import { createCuratedProviderInventory } from './provider-inventory.ts';

test('createCuratedProviderInventory seeds the current OpenRouter Kimi model', () => {
    const models = createCuratedProviderInventory('openrouter').models;

    expect(models).toContainEqual({
        capabilities: ['general'],
        contextWindow: null,
        description: null,
        displayName: 'Gemini 2.5 Flash Lite',
        modelId: 'google/gemini-2.5-flash-lite',
        provider: 'openrouter',
        ref: 'openrouter/google/gemini-2.5-flash-lite',
    });
    expect(models).toContainEqual({
        capabilities: ['general'],
        contextWindow: 262_144,
        description: null,
        displayName: 'Kimi K2.5',
        modelId: 'moonshotai/kimi-k2.5',
        provider: 'openrouter',
        ref: 'openrouter/moonshotai/kimi-k2.5',
    });
});

test('createCuratedProviderInventory documents OpenAI import model capabilities', () => {
    const models = createCuratedProviderInventory('openai').models;

    expect(models).toContainEqual({
        capabilities: ['general', 'vision'],
        contextWindow: 128_000,
        description: null,
        displayName: 'GPT-4o Mini',
        modelId: 'gpt-4o-mini',
        provider: 'openai',
        ref: 'openai/gpt-4o-mini',
    });
    expect(models).toContainEqual({
        capabilities: ['audio-transcription'],
        contextWindow: null,
        description: null,
        displayName: 'Whisper',
        modelId: 'whisper-1',
        provider: 'openai',
        ref: 'openai/whisper-1',
    });
});
