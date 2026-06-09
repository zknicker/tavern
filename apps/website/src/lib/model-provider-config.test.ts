import { expect, test } from 'bun:test';
import {
    formatModelOptionLabel,
    getModelIdentityConfig,
    getModelIdentityConfigFromRef,
    getModelProviderConfig,
    getModelProviderConfigFromAccessId,
} from './model-provider-config.ts';

test('provider config normalizes known model providers for the app UI', () => {
    expect(getModelProviderConfig('openai-codex')).toMatchObject({
        accessDisplayName: 'Codex',
        color: '#3B82F6',
        configName: 'openai-codex',
        displayName: 'OpenAI Codex',
    });
});

test('removed providers fall back to generic display metadata', () => {
    expect(getModelProviderConfig('claude')).toMatchObject({
        accessId: null,
        configName: 'claude',
        displayName: 'Claude',
    });
});

test('access ids resolve back to the same provider branding', () => {
    expect(getModelProviderConfigFromAccessId('codex')).toMatchObject({
        accessDisplayName: 'Codex',
        configName: 'openai-codex',
        displayName: 'OpenAI Codex',
    });
});

test('model config uses Hermes labels without repeating the provider label', () => {
    expect(
        getModelIdentityConfig({
            fallbackName: 'OpenAI Codex',
            modelId: 'gpt-5.4',
            providerId: 'openai-codex',
        })
    ).toMatchObject({
        displayName: 'gpt-5.4',
        ref: 'openai-codex/gpt-5.4',
    });

    expect(
        getModelIdentityConfigFromRef('openrouter/moonshotai/kimi-k2.5', 'MoonshotAI: Kimi K2.5')
    ).toMatchObject({
        displayName: 'MoonshotAI: Kimi K2.5',
        ref: 'openrouter/moonshotai/kimi-k2.5',
    });
});

test('model option labels fall back to model ids when Hermes metadata is missing', () => {
    expect(
        formatModelOptionLabel({
            modelId: 'gpt-5.4-mini',
            providerId: 'openai-codex',
        })
    ).toBe('gpt-5.4-mini');
});
