import { afterEach, mock, spyOn, test } from 'bun:test';
import assert from 'node:assert/strict';
import { TRPCError } from '@trpc/server';
import { ensureDatabaseSchema } from '../db/bootstrap.ts';
import { databaseClient } from '../db/index.ts';
import * as inventoryCache from '../model/inventory-cache.ts';
import type { ModelInventorySnapshot, ModelProviderId } from '../model/inventory-contracts.ts';
import { saveMemorySettings } from './service.ts';

ensureDatabaseSchema();

afterEach(() => {
    mock.restore();
    databaseClient.exec('DELETE FROM memory_settings;');
});

test('saveMemorySettings rejects enabled memory without all required slots', async () => {
    await assert.rejects(
        () =>
            saveMemorySettings({
                dreamModel: null,
                knowledgeModel: 'openrouter/openai/gpt-5.4-mini',
                memoryEnabled: true,
                persistenceModel: 'openrouter/openai/gpt-5.4',
                workingModel: 'openrouter/openai/gpt-5.4-mini',
            }),
        (error: unknown) => {
            assert.equal(error instanceof Error, true);
            assert.match((error as Error).message, /Select a dream model before enabling memory\./);
            return true;
        }
    );
});

test('saveMemorySettings rejects models that are not enabled in Tavern catalog', async () => {
    spyOn(inventoryCache, 'loadProviderInventory').mockImplementation(async (provider) =>
        createSnapshot(provider, {
            openrouter: ['openai/gpt-5.4-mini'],
        })
    );

    await assert.rejects(
        () =>
            saveMemorySettings({
                dreamModel: 'openrouter/openai/gpt-5.4',
                knowledgeModel: 'openrouter/openai/gpt-5.4-mini',
                memoryEnabled: false,
                persistenceModel: 'openrouter/openai/gpt-5.4',
                workingModel: 'openrouter/openai/gpt-5.4-mini',
            }),
        (error: unknown) => {
            assert.ok(error instanceof TRPCError);
            assert.equal(error.code, 'BAD_REQUEST');
            assert.equal(error.message, 'The dream memory model must be an enabled Tavern model.');
            return true;
        }
    );
});

test('saveMemorySettings stores validated settings in Tavern memory settings', async () => {
    spyOn(inventoryCache, 'loadProviderInventory').mockImplementation(async (provider) =>
        createSnapshot(provider, {
            openrouter: ['openai/gpt-5.4', 'openai/gpt-5.4-mini'],
        })
    );

    const result = await saveMemorySettings({
        dreamModel: 'openrouter/openai/gpt-5.4',
        knowledgeModel: 'openrouter/openai/gpt-5.4-mini',
        memoryEnabled: true,
        persistenceModel: 'openrouter/openai/gpt-5.4',
        workingModel: 'openrouter/openai/gpt-5.4-mini',
    });

    assert.deepEqual(result, {
        dreamModel: 'openrouter/openai/gpt-5.4',
        knowledgeModel: 'openrouter/openai/gpt-5.4-mini',
        memoryEnabled: true,
        persistenceModel: 'openrouter/openai/gpt-5.4',
        updatedAt: result.updatedAt,
        workingModel: 'openrouter/openai/gpt-5.4-mini',
    });
    assert.match(result.updatedAt ?? '', /^\d{4}-\d{2}-\d{2}T/u);
});

function createSnapshot(
    provider: ModelProviderId,
    modelsByProvider: Partial<Record<ModelProviderId, string[]>> = {}
): ModelInventorySnapshot {
    return {
        models: (modelsByProvider[provider] ?? []).map((modelId) => ({
            contextWindow: null,
            description: null,
            displayName: modelId,
            modelId,
            provider,
            ref: `${provider}/${modelId}`,
        })),
        provider,
        syncedAt: '2026-04-22T17:00:00.000Z',
    };
}
