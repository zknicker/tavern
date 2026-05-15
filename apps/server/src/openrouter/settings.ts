import { z } from 'zod';
import {
    deleteTavernVaultSecret,
    getTavernVaultSecret,
    saveTavernVaultSecret,
    tavernVaultSecretIds,
} from '../storage/tavern-vault.ts';

const openRouterSecretSchema = z.object({
    apiKey: z.string(),
    managementApiKey: z.string(),
});

export interface OpenRouterSettings {
    apiKey: string;
    hasApiKey: boolean;
    hasManagementApiKey: boolean;
    managementApiKey: string;
    updatedAt: null | string;
}

export async function getOpenRouterSettings(): Promise<OpenRouterSettings | null> {
    const stored = await getTavernVaultSecret({
        id: tavernVaultSecretIds.openRouterSettings,
        schema: openRouterSecretSchema,
    });

    if (!stored) {
        return null;
    }

    return toOpenRouterSettings({
        secret: stored.secret,
        updatedAt: stored.updatedAt,
    });
}

export async function saveOpenRouterSettings(input: {
    apiKey?: string | null;
    managementApiKey?: string | null;
}): Promise<OpenRouterSettings | null> {
    const current = await getTavernVaultSecret({
        id: tavernVaultSecretIds.openRouterSettings,
        schema: openRouterSecretSchema,
    });
    const apiKey = input.apiKey?.trim() || current?.secret.apiKey || '';
    const managementApiKey =
        input.managementApiKey?.trim() || current?.secret.managementApiKey || '';

    if (!(apiKey || managementApiKey)) {
        return await getOpenRouterSettings();
    }

    const saved = await saveTavernVaultSecret({
        id: tavernVaultSecretIds.openRouterSettings,
        secret: {
            apiKey,
            managementApiKey,
        },
    });

    return toOpenRouterSettings({
        secret: {
            apiKey,
            managementApiKey,
        },
        updatedAt: saved.updatedAt,
    });
}

export async function deleteOpenRouterSettings(): Promise<OpenRouterSettings> {
    await deleteTavernVaultSecret(tavernVaultSecretIds.openRouterSettings);

    return toOpenRouterSettings({
        secret: {
            apiKey: '',
            managementApiKey: '',
        },
        updatedAt: null,
    });
}

function toOpenRouterSettings(input: {
    secret: z.infer<typeof openRouterSecretSchema>;
    updatedAt: null | string;
}): OpenRouterSettings {
    return {
        apiKey: input.secret.apiKey,
        hasApiKey: input.secret.apiKey.length > 0,
        hasManagementApiKey: input.secret.managementApiKey.length > 0,
        managementApiKey: input.secret.managementApiKey,
        updatedAt: input.updatedAt,
    };
}
