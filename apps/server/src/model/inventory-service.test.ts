import { afterEach, mock, spyOn, test } from 'bun:test';
import assert from 'node:assert/strict';
import * as invalidationEvents from '../api/invalidation-events.ts';
import * as modelAccessService from '../model-access/service.ts';
import * as openRouterSettings from '../openrouter/settings.ts';
import * as inventoryCache from './inventory-cache.ts';
import type { ModelInventorySnapshot, ModelProviderId } from './inventory-contracts.ts';
import { addCatalogModel, deleteCatalogModel } from './inventory-service.ts';

afterEach(() => {
    mock.restore();
});

test('addCatalogModel stores a new curated catalog model', async () => {
    mockProviderConnections();
    spyOn(invalidationEvents, 'emitModelUpdated').mockImplementation(() => {});
    spyOn(inventoryCache, 'loadProviderInventory').mockImplementation(async (provider) =>
        createSnapshot(provider)
    );
    const saveProviderInventory = spyOn(
        inventoryCache,
        'saveProviderInventory'
    ).mockResolvedValue();

    await addCatalogModel({
        modelId: 'moonshotai/kimi-k2.5',
        provider: 'openrouter',
    });

    assert.equal(saveProviderInventory.mock.calls.length, 1);
    const savedSnapshot = saveProviderInventory.mock.calls[0]?.[0];
    assert.equal(
        savedSnapshot?.models.some(
            (model) =>
                model.ref === 'openrouter/moonshotai/kimi-k2.5' &&
                model.displayName === 'Moonshotai Kimi K2.5'
        ),
        true
    );
});

test('deleteCatalogModel removes unused catalog models', async () => {
    mockProviderConnections();
    spyOn(invalidationEvents, 'emitModelUpdated').mockImplementation(() => {});
    spyOn(inventoryCache, 'loadProviderInventory').mockImplementation(async (provider) =>
        createSnapshot(provider, {
            openrouter: [
                {
                    displayName: 'Kimi K2.5',
                    modelId: 'moonshotai/kimi-k2.5',
                },
            ],
        })
    );
    const saveProviderInventory = spyOn(
        inventoryCache,
        'saveProviderInventory'
    ).mockResolvedValue();

    await deleteCatalogModel({ modelRef: 'openrouter/moonshotai/kimi-k2.5' });

    const savedSnapshot = saveProviderInventory.mock.calls[0]?.[0];
    assert.equal(
        savedSnapshot?.models.some((model) => model.ref === 'openrouter/moonshotai/kimi-k2.5'),
        false
    );
});

function mockProviderConnections() {
    spyOn(modelAccessService, 'listModelAccessStatuses').mockResolvedValue([
        {
            description: 'Connected to Tavern Vault',
            id: 'codex',
            source: 'file',
            state: 'live',
        },
    ]);
    spyOn(openRouterSettings, 'getOpenRouterSettings').mockResolvedValue({
        apiKey: '',
        hasApiKey: true,
        hasManagementApiKey: false,
        managementApiKey: '',
        updatedAt: '2026-04-22T17:00:00.000Z',
    });
}

function createSnapshot(
    provider: ModelProviderId,
    modelsByProvider: Partial<
        Record<ModelProviderId, Array<{ displayName: string; modelId: string }>>
    > = {}
): ModelInventorySnapshot {
    return {
        models: (modelsByProvider[provider] ?? []).map((model) => ({
            contextWindow: null,
            description: null,
            displayName: model.displayName,
            modelId: model.modelId,
            provider,
            ref: `${provider}/${model.modelId}`,
        })),
        provider,
        syncedAt: '2026-04-22T17:00:00.000Z',
    };
}
