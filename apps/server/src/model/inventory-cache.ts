import { deleteCachedDocument, loadCachedDocument, saveCachedDocument } from '../storage/cache.ts';
import {
    type ModelInventorySnapshot,
    type ModelProviderId,
    modelInventorySnapshotSchema,
} from './inventory-contracts.ts';
import { createCuratedProviderInventory, sortModels } from './provider-inventory.ts';

const providerCacheIds = {
    claude: 'model-inventory-claude',
    codex: 'model-inventory-codex',
    openrouter: 'model-inventory-openrouter',
} as const satisfies Record<ModelProviderId, Parameters<typeof loadCachedDocument>[0]>;

export async function loadProviderInventory(provider: ModelProviderId) {
    try {
        const snapshot = await loadCachedDocument(
            providerCacheIds[provider],
            modelInventorySnapshotSchema
        );

        if (snapshot) {
            return {
                ...snapshot,
                models: sortModels(snapshot.models),
            };
        }
    } catch (_error) {
        await deleteProviderInventory(provider);
    }

    const snapshot = createCuratedProviderInventory(provider);
    await saveProviderInventory(snapshot);
    return snapshot;
}

export async function saveProviderInventory(snapshot: ModelInventorySnapshot) {
    await saveCachedDocument(providerCacheIds[snapshot.provider], snapshot);
}

export async function deleteProviderInventory(provider: ModelProviderId) {
    await deleteCachedDocument(providerCacheIds[provider]);
}
