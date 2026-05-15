import { expect, test } from 'bun:test';
import { createCuratedProviderInventory } from './provider-inventory.ts';

test('createCuratedProviderInventory seeds the current OpenRouter Kimi model', () => {
    expect(createCuratedProviderInventory('openrouter').models).toContainEqual({
        contextWindow: 262_144,
        description: null,
        displayName: 'Kimi K2.5',
        modelId: 'moonshotai/kimi-k2.5',
        provider: 'openrouter',
        ref: 'openrouter/moonshotai/kimi-k2.5',
    });
});
