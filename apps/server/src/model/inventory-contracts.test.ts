import { expect, test } from 'bun:test';
import {
    modelCapabilitySchema,
    modelInventoryProviderSchema,
    modelInventorySnapshotSchema,
} from './inventory-contracts.ts';

test('modelInventorySnapshotSchema accepts provider records without usage labels', () => {
    expect(
        modelInventorySnapshotSchema.parse({
            models: [
                {
                    capability: 'agent',
                    contextWindow: null,
                    description: null,
                    displayName: 'GPT-5.5',
                    modelId: 'gpt-5.5',
                    provider: 'openai-codex',
                    ref: 'openai-codex/gpt-5.5',
                },
            ],
            provider: 'openai-codex',
            syncedAt: '2026-04-22T17:00:00.000Z',
        })
    ).toEqual({
        models: [
            {
                capability: 'agent',
                capabilities: ['general'],
                contextWindow: null,
                description: null,
                displayName: 'GPT-5.5',
                modelId: 'gpt-5.5',
                provider: 'openai-codex',
                ref: 'openai-codex/gpt-5.5',
            },
        ],
        provider: 'openai-codex',
        syncedAt: '2026-04-22T17:00:00.000Z',
    });
});

test('modelCapabilitySchema accepts import processor capabilities', () => {
    expect(modelCapabilitySchema.parse('audio-transcription')).toBe('audio-transcription');
    expect(modelCapabilitySchema.parse('vision')).toBe('vision');
});

test('modelInventoryProviderSchema still requires usage labels on the live API shape', () => {
    expect(() =>
        modelInventoryProviderSchema.parse({
            authAction: null,
            authType: null,
            connectionDetail: null,
            displayName: 'Openai Codex',
            isConnected: true,
            keyEnv: null,
            models: [
                {
                    capability: 'agent',
                    capabilities: ['general'],
                    contextWindow: null,
                    canDelete: false,
                    description: null,
                    displayName: 'GPT-5.5',
                    inUse: true,
                    modelId: 'gpt-5.5',
                    provider: 'openai-codex',
                    ref: 'openai-codex/gpt-5.5',
                },
            ],
            provider: 'openai-codex',
            state: 'connected',
            stateMessage: 'Connected',
        })
    ).toThrow(/usageLabels/);
});
