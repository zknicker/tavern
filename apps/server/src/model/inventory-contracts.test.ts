import { expect, test } from 'bun:test';
import {
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
                    displayName: 'Claude Sonnet 4.6',
                    modelId: 'claude-sonnet-4-6',
                    provider: 'claude',
                    ref: 'claude/claude-sonnet-4-6',
                },
            ],
            provider: 'claude',
            syncedAt: '2026-04-22T17:00:00.000Z',
        })
    ).toEqual({
        models: [
            {
                contextWindow: null,
                description: null,
                displayName: 'Claude Sonnet 4.6',
                modelId: 'claude-sonnet-4-6',
                provider: 'claude',
                ref: 'claude/claude-sonnet-4-6',
            },
        ],
        provider: 'claude',
        syncedAt: '2026-04-22T17:00:00.000Z',
    });
});

test('modelInventoryProviderSchema still requires usage labels on the live API shape', () => {
    expect(() =>
        modelInventoryProviderSchema.parse({
            displayName: 'Claude',
            isConnected: true,
            models: [
                {
                    contextWindow: null,
                    canDelete: false,
                    description: null,
                    displayName: 'Claude Sonnet 4.6',
                    inUse: true,
                    modelId: 'claude-sonnet-4-6',
                    provider: 'claude',
                    ref: 'claude/claude-sonnet-4-6',
                },
            ],
            provider: 'claude',
            state: 'connected',
            stateMessage: 'Claude Code is available on the runtime from a runtime auth file.',
        })
    ).toThrow(/usageLabels/);
});
