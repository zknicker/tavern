import { expect, test } from 'bun:test';
import {
    modelCapabilitySchema,
    modelInventoryProviderSchema,
    modelInventorySnapshotSchema,
} from './inventory-contracts.ts';

test('modelInventorySnapshotSchema accepts cached provider records without usage labels', () => {
    expect(
        modelInventorySnapshotSchema.parse({
            models: [
                {
                    contextWindow: null,
                    description: null,
                    displayName: 'GPT-5.4',
                    modelId: 'gpt-5.4',
                    provider: 'codex',
                    ref: 'codex/gpt-5.4',
                },
            ],
            provider: 'codex',
            syncedAt: '2026-04-22T17:00:00.000Z',
        })
    ).toEqual({
        models: [
            {
                capabilities: ['general'],
                contextWindow: null,
                description: null,
                displayName: 'GPT-5.4',
                modelId: 'gpt-5.4',
                provider: 'codex',
                ref: 'codex/gpt-5.4',
            },
        ],
        provider: 'codex',
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
            displayName: 'Codex',
            isConnected: true,
            models: [
                {
                    capabilities: ['general'],
                    contextWindow: null,
                    canDelete: false,
                    description: null,
                    displayName: 'GPT-5.4',
                    inUse: true,
                    modelId: 'gpt-5.4',
                    provider: 'codex',
                    ref: 'codex/gpt-5.4',
                },
            ],
            provider: 'codex',
            state: 'connected',
            stateMessage: 'Using Codex local auth.',
        })
    ).toThrow(/usageLabels/);
});
