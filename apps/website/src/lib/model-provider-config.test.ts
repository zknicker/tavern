import { expect, test } from 'bun:test';
import {
    formatModelOptionLabel,
    getModelIdentityConfig,
    getModelIdentityConfigFromRef,
    getModelProviderConfig,
    getModelProviderConfigFromAccessId,
} from './model-provider-config.ts';

test('provider config normalizes known model providers for the app UI', () => {
    expect(getModelProviderConfig('codex')).toMatchObject({
        accessDisplayName: 'Codex',
        color: '#3B82F6',
        configName: 'codex',
        displayName: 'Codex',
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
        configName: 'codex',
        displayName: 'Codex',
    });
});

test('model config normalizes known model ids without repeating the provider label', () => {
    expect(
        getModelIdentityConfig({
            fallbackName: 'Codex',
            modelId: 'gpt-5.4',
            providerId: 'codex',
        })
    ).toMatchObject({
        displayName: 'GPT-5.4',
        ref: 'codex/gpt-5.4',
    });

    expect(
        getModelIdentityConfigFromRef('openrouter/moonshotai/kimi-k2.5', 'MoonshotAI: Kimi K2.5')
    ).toMatchObject({
        displayName: 'Kimi K2.5',
        ref: 'openrouter/moonshotai/kimi-k2.5',
    });
});

test('model option labels use the shared model display registry', () => {
    expect(
        formatModelOptionLabel({
            modelId: 'gpt-5.4-mini',
            providerId: 'codex',
        })
    ).toBe('GPT-5.4 Mini');
});
