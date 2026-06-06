import { z } from 'zod';
import { createConfiguredAgentRuntimeClient } from '../agent-runtime/configured-client.ts';
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
    const runtimeSettings = await getRuntimeOpenRouterSettings();
    if (runtimeSettings) {
        return runtimeSettings;
    }

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
    const client = createConfiguredAgentRuntimeClient();
    if (client) {
        try {
            const payload = {
                ...(input.apiKey?.trim() ? { apiKey: input.apiKey.trim() } : {}),
                ...(input.managementApiKey?.trim()
                    ? { managementApiKey: input.managementApiKey.trim() }
                    : {}),
            };
            return Object.keys(payload).length > 0
                ? await client.saveOpenRouterSettings(payload)
                : await client.getOpenRouterSettings();
        } finally {
            client.close();
        }
    }

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
    const client = createConfiguredAgentRuntimeClient();
    if (client) {
        try {
            return await client.deleteOpenRouterSettings();
        } finally {
            client.close();
        }
    }

    await deleteTavernVaultSecret(tavernVaultSecretIds.openRouterSettings);

    return toOpenRouterSettings({
        secret: {
            apiKey: '',
            managementApiKey: '',
        },
        updatedAt: null,
    });
}

async function getRuntimeOpenRouterSettings(): Promise<OpenRouterSettings | null> {
    const client = createConfiguredAgentRuntimeClient();
    if (!client) {
        return null;
    }
    try {
        return await client.getOpenRouterSettings();
    } finally {
        client.close();
    }
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
