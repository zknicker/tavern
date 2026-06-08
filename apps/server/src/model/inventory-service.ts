import type { ModelInventory, ModelInventoryProvider } from './inventory-contracts.ts';
import { modelInventorySchema } from './inventory-contracts.ts';
import { listModels } from './service.ts';

export async function listModelInventory(): Promise<ModelInventory> {
    const models = (await listModels()).models.filter(
        (model) => model.availability === 'available'
    );
    const providersById = new Map<string, ModelInventoryProvider>();

    for (const model of models) {
        const provider =
            providersById.get(model.provider) ??
            createInventoryProvider({
                provider: model.provider,
            });

        provider.models.push({
            canDelete: false,
            capabilities: ['general'],
            contextWindow: model.contextWindow,
            description: null,
            displayName: model.name,
            inUse: false,
            modelId: model.modelId,
            provider: model.provider,
            ref: model.ref,
            usageLabels: [],
        });
        providersById.set(model.provider, provider);
    }

    return modelInventorySchema.parse({
        providers: [...providersById.values()]
            .map((provider) => ({
                ...provider,
                models: provider.models.sort(
                    (left, right) =>
                        left.displayName.localeCompare(right.displayName) ||
                        left.ref.localeCompare(right.ref)
                ),
            }))
            .sort(
                (left, right) =>
                    left.displayName.localeCompare(right.displayName) ||
                    left.provider.localeCompare(right.provider)
            ),
    });
}

function createInventoryProvider(input: { provider: string }): ModelInventoryProvider {
    return {
        displayName: formatProviderName(input.provider),
        isConnected: true,
        models: [],
        provider: input.provider,
        state: 'connected',
        stateMessage: 'Available from Hermes.',
    };
}

function formatProviderName(provider: string) {
    return provider
        .trim()
        .split(/[-_/]+/gu)
        .filter(Boolean)
        .map((segment) => segment[0]?.toUpperCase() + segment.slice(1))
        .join(' ');
}
