import { z } from 'zod';
import {
    deleteTavernVaultSecret,
    getTavernVaultSecret,
    tavernVaultSecretIds,
} from '../storage/tavern-vault.ts';
import {
    deleteUsageSourceSettings,
    getUsageSourceSettings,
    saveUsageSourceSettings,
    usageSourceSettingIds,
} from '../storage/usage-source-settings.ts';

const openRouterStatsSettingsSchema = z.object({
    managementApiKey: z.string(),
});

const legacyOpenRouterSettingsSchema = z.object({
    apiKey: z.string().optional(),
    managementApiKey: z.string().optional(),
});

export interface OpenRouterSettings {
    apiKey: string;
    hasApiKey: boolean;
    hasManagementApiKey: boolean;
    managementApiKey: string;
    updatedAt: null | string;
}

export async function getOpenRouterSettings(): Promise<OpenRouterSettings | null> {
    const stored = await getUsageSourceSettings({
        id: usageSourceSettingIds.openRouter,
        schema: openRouterStatsSettingsSchema,
    });

    if (stored) {
        return toOpenRouterSettings({
            settings: stored.settings,
            updatedAt: stored.updatedAt,
        });
    }

    return await migrateLegacyOpenRouterSettings();
}

export async function saveOpenRouterSettings(input: {
    apiKey?: string | null;
    managementApiKey?: string | null;
}): Promise<OpenRouterSettings | null> {
    const current = await getUsageSourceSettings({
        id: usageSourceSettingIds.openRouter,
        schema: openRouterStatsSettingsSchema,
    });
    const managementApiKey =
        input.managementApiKey?.trim() || current?.settings.managementApiKey || '';

    if (!managementApiKey) {
        return await getOpenRouterSettings();
    }

    const saved = await saveUsageSourceSettings({
        id: usageSourceSettingIds.openRouter,
        settings: {
            managementApiKey,
        },
    });

    return toOpenRouterSettings({
        settings: {
            managementApiKey,
        },
        updatedAt: saved.updatedAt,
    });
}

export async function deleteOpenRouterSettings(): Promise<OpenRouterSettings> {
    await Promise.all([
        deleteUsageSourceSettings(usageSourceSettingIds.openRouter),
        deleteTavernVaultSecret(tavernVaultSecretIds.openRouterSettings),
    ]);

    return toOpenRouterSettings({
        settings: {
            managementApiKey: '',
        },
        updatedAt: null,
    });
}

function toOpenRouterSettings(input: {
    settings: z.infer<typeof openRouterStatsSettingsSchema>;
    updatedAt: null | string;
}): OpenRouterSettings {
    return {
        apiKey: '',
        hasApiKey: false,
        hasManagementApiKey: input.settings.managementApiKey.length > 0,
        managementApiKey: input.settings.managementApiKey,
        updatedAt: input.updatedAt,
    };
}

async function migrateLegacyOpenRouterSettings(): Promise<OpenRouterSettings | null> {
    const legacy = await getTavernVaultSecret({
        id: tavernVaultSecretIds.openRouterSettings,
        schema: legacyOpenRouterSettingsSchema,
    });
    const managementApiKey = legacy?.secret.managementApiKey?.trim() ?? '';

    if (!managementApiKey) {
        return null;
    }

    const saved = await saveUsageSourceSettings({
        id: usageSourceSettingIds.openRouter,
        settings: {
            managementApiKey,
        },
    });
    await deleteTavernVaultSecret(tavernVaultSecretIds.openRouterSettings);

    return toOpenRouterSettings({
        settings: {
            managementApiKey,
        },
        updatedAt: saved.updatedAt,
    });
}
