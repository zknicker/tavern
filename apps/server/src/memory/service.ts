import { TRPCError } from '@trpc/server';
import { env } from '../config/env.ts';
import { loadProviderInventory } from '../model/inventory-cache.ts';
import { modelInventoryProviders } from '../model/provider-inventory.ts';
import { getStoredMemorySettings, saveStoredMemorySettings } from '../storage/memory-settings.ts';
import {
    type MemorySettings,
    memorySettingsSchema,
    saveMemorySettingsInputSchema,
} from './contracts.ts';

const memorySlotLabels = {
    dreamModel: 'dream',
    knowledgeModel: 'knowledge',
    persistenceModel: 'persistence',
    workingModel: 'working',
} as const;

const emptyMemorySettings = memorySettingsSchema.parse({
    dreamModel: null,
    knowledgeModel: null,
    memoryEnabled: false,
    persistenceModel: null,
    updatedAt: null,
    workingModel: null,
});

async function listConfiguredModelRefs() {
    const snapshots = await Promise.all(
        modelInventoryProviders.map((provider) => loadProviderInventory(provider))
    );

    return new Set(snapshots.flatMap((snapshot) => snapshot.models.map((model) => model.ref)));
}

async function validateConfiguredModelIds(input: {
    dreamModel: null | string;
    knowledgeModel: null | string;
    persistenceModel: null | string;
    workingModel: null | string;
}) {
    const configuredModelRefs = await listConfiguredModelRefs();

    if (configuredModelRefs.size === 0) {
        throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: 'No Tavern models are configured.',
        });
    }

    for (const slot of Object.keys(memorySlotLabels) as Array<keyof typeof memorySlotLabels>) {
        const selectedModel = input[slot];

        if (!selectedModel || configuredModelRefs.has(selectedModel)) {
            continue;
        }

        throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `The ${memorySlotLabels[slot]} memory model must be an enabled Tavern model.`,
        });
    }
}

function isMemoryReady(settings: MemorySettings) {
    return Boolean(
        settings.memoryEnabled &&
            settings.dreamModel &&
            settings.knowledgeModel &&
            settings.persistenceModel &&
            settings.workingModel
    );
}

export async function getMemorySettings() {
    return (await getStoredMemorySettings()) ?? emptyMemorySettings;
}

export async function getMemoryStatus() {
    const settings = await getMemorySettings();

    return {
        embedderStatus: isMemoryReady(settings) ? 'ready' : 'disabled',
        lanceDbPath: env.DATABASE_PATH,
        lastBulletinBuildAt: null,
        lastCaptureAt: null,
        lastDreamRunAt: null,
        lastWorkingSynthesisAt: null,
    };
}

export async function saveMemorySettings(input: unknown) {
    const parsed = saveMemorySettingsInputSchema.parse(input);
    const settings = {
        dreamModel: parsed.dreamModel,
        knowledgeModel: parsed.knowledgeModel,
        memoryEnabled: parsed.memoryEnabled,
        persistenceModel: parsed.persistenceModel,
        workingModel: parsed.workingModel,
    };

    await validateConfiguredModelIds(settings);

    return await saveStoredMemorySettings(settings);
}
