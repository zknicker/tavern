import {
    type AgentRuntimeOpenRouterSettings,
    type AgentRuntimeSaveOpenRouterSettings,
    agentRuntimeOpenRouterSettingsSchema,
    agentRuntimeRoutes,
    agentRuntimeSaveOpenRouterSettingsSchema,
} from '@tavern/api';
import { readConfigValue } from '../config';
import { getDb } from '../db/connection';
import { namedParams } from '../db/sqlite';
import { log } from '../log';
import { json } from '../tavern/http';

const openRouterSettingsSecretId = 'model-access:openrouter';

interface TavernVaultSecretRow {
    secret_json: string;
    updated_at: string;
}

interface StoredOpenRouterSettings {
    apiKey: string;
    managementApiKey: string;
}

export async function handleOpenRouterSettingsRequest(request: Request): Promise<Response | null> {
    const url = new URL(request.url);
    if (url.pathname !== agentRuntimeRoutes.modelAccessOpenRouterSettings) {
        return null;
    }

    if (request.method === 'GET') {
        return json(agentRuntimeOpenRouterSettingsSchema.parse(getOpenRouterSettings()));
    }
    if (request.method === 'PUT') {
        const input = agentRuntimeSaveOpenRouterSettingsSchema.parse(await readJson(request));
        const settings = saveOpenRouterSettings(input);
        await refreshOpenRouterDependentCapabilities();
        return json(agentRuntimeOpenRouterSettingsSchema.parse(settings));
    }
    if (request.method === 'DELETE') {
        const settings = deleteOpenRouterSettings();
        await refreshOpenRouterDependentCapabilities();
        return json(agentRuntimeOpenRouterSettingsSchema.parse(settings));
    }

    return null;
}

export function getOpenRouterSettings(): AgentRuntimeOpenRouterSettings {
    const row = getOpenRouterSettingsRow();
    if (!row) {
        return toOpenRouterSettings({ apiKey: '', managementApiKey: '' }, null);
    }
    return toOpenRouterSettings(parseOpenRouterSettings(row.secret_json), row.updated_at);
}

export function getOpenRouterApiKey(): string | null {
    try {
        const settings = getOpenRouterSettings();
        return settings.apiKey.trim() || null;
    } catch {
        return null;
    }
}

export async function resolveOpenRouterApiKey(): Promise<string | null> {
    return readConfigValue('OPENROUTER_API_KEY') ?? getOpenRouterApiKey();
}

function saveOpenRouterSettings(
    input: AgentRuntimeSaveOpenRouterSettings
): AgentRuntimeOpenRouterSettings {
    const current = getOpenRouterSettings();
    const next = {
        apiKey: input.apiKey?.trim() || current.apiKey,
        managementApiKey: input.managementApiKey?.trim() || current.managementApiKey,
    };
    if (!(next.apiKey || next.managementApiKey)) {
        return toOpenRouterSettings(next, current.updatedAt);
    }

    const now = new Date().toISOString();
    getDb()
        .prepare(
            `INSERT INTO tavern_vault_secrets (id, secret_json, created_at, updated_at)
             VALUES ($id, $secretJson, $now, $now)
             ON CONFLICT(id) DO UPDATE SET
               secret_json = excluded.secret_json,
               updated_at = excluded.updated_at`
        )
        .run(
            namedParams({
                id: openRouterSettingsSecretId,
                now,
                secretJson: JSON.stringify(next),
            })
        );

    return toOpenRouterSettings(next, now);
}

function deleteOpenRouterSettings(): AgentRuntimeOpenRouterSettings {
    getDb()
        .prepare('DELETE FROM tavern_vault_secrets WHERE id = $id')
        .run(namedParams({ id: openRouterSettingsSecretId }));
    return toOpenRouterSettings({ apiKey: '', managementApiKey: '' }, null);
}

function getOpenRouterSettingsRow(): TavernVaultSecretRow | null {
    return (
        (getDb()
            .prepare(
                `SELECT secret_json, updated_at
                 FROM tavern_vault_secrets
                 WHERE id = $id`
            )
            .get(namedParams({ id: openRouterSettingsSecretId })) as TavernVaultSecretRow | null) ??
        null
    );
}

function toOpenRouterSettings(
    secret: StoredOpenRouterSettings,
    updatedAt: string | null
): AgentRuntimeOpenRouterSettings {
    return {
        apiKey: secret.apiKey,
        hasApiKey: secret.apiKey.length > 0,
        hasManagementApiKey: secret.managementApiKey.length > 0,
        managementApiKey: secret.managementApiKey,
        updatedAt,
    };
}

function parseOpenRouterSettings(secretJson: string): StoredOpenRouterSettings {
    try {
        const parsed = JSON.parse(secretJson) as Partial<StoredOpenRouterSettings>;
        return {
            apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : '',
            managementApiKey:
                typeof parsed.managementApiKey === 'string' ? parsed.managementApiKey : '',
        };
    } catch {
        return { apiKey: '', managementApiKey: '' };
    }
}

async function readJson(request: Request): Promise<unknown> {
    return await request.json().catch(() => ({}));
}

async function refreshOpenRouterDependentCapabilities(): Promise<void> {
    log.info('OpenRouter model access changed.');
}
