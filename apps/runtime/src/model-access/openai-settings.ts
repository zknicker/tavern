import {
    type AgentRuntimeOpenAiSettings,
    type AgentRuntimeSaveOpenAiSettings,
    agentRuntimeOpenAiSettingsSchema,
    agentRuntimeRoutes,
    agentRuntimeSaveOpenAiSettingsSchema,
} from '@tavern/api';
import { getDb } from '../db/connection';
import { namedParams } from '../db/sqlite';
import { log } from '../log';
import { json } from '../tavern/http';

const openAiSettingsSecretId = 'model-access:openai';

interface TavernVaultSecretRow {
    secret_json: string;
    updated_at: string;
}

interface StoredOpenAiSettings {
    apiKey: string;
}

export async function handleOpenAiSettingsRequest(request: Request): Promise<Response | null> {
    const url = new URL(request.url);
    if (url.pathname !== agentRuntimeRoutes.modelAccessOpenAiSettings) {
        return null;
    }

    if (request.method === 'GET') {
        return json(agentRuntimeOpenAiSettingsSchema.parse(getOpenAiSettings()));
    }
    if (request.method === 'PUT') {
        const input = agentRuntimeSaveOpenAiSettingsSchema.parse(await readJson(request));
        const settings = saveOpenAiSettings(input);
        await refreshOpenAiDependentSchedules();
        return json(agentRuntimeOpenAiSettingsSchema.parse(settings));
    }
    if (request.method === 'DELETE') {
        const settings = deleteOpenAiSettings();
        await refreshOpenAiDependentSchedules();
        return json(agentRuntimeOpenAiSettingsSchema.parse(settings));
    }

    return null;
}

export function getOpenAiSettings(): AgentRuntimeOpenAiSettings {
    const row = getOpenAiSettingsRow();
    if (!row) {
        return toOpenAiSettings({ apiKey: '' }, null);
    }
    return toOpenAiSettings(parseOpenAiSettings(row.secret_json), row.updated_at);
}

export function getOpenAiApiKey(): string | null {
    try {
        return getOpenAiSettings().apiKey.trim() || null;
    } catch {
        return null;
    }
}

export function saveOpenAiSettings(
    input: AgentRuntimeSaveOpenAiSettings
): AgentRuntimeOpenAiSettings {
    const apiKey = input.apiKey.trim();
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
                id: openAiSettingsSecretId,
                now,
                secretJson: JSON.stringify({ apiKey }),
            })
        );

    return toOpenAiSettings({ apiKey }, now);
}

function deleteOpenAiSettings(): AgentRuntimeOpenAiSettings {
    getDb()
        .prepare('DELETE FROM tavern_vault_secrets WHERE id = $id')
        .run(namedParams({ id: openAiSettingsSecretId }));
    return toOpenAiSettings({ apiKey: '' }, null);
}

function getOpenAiSettingsRow(): TavernVaultSecretRow | null {
    return (
        (getDb()
            .prepare(
                `SELECT secret_json, updated_at
                 FROM tavern_vault_secrets
                 WHERE id = $id`
            )
            .get(namedParams({ id: openAiSettingsSecretId })) as TavernVaultSecretRow | null) ??
        null
    );
}

function toOpenAiSettings(
    secret: StoredOpenAiSettings,
    updatedAt: string | null
): AgentRuntimeOpenAiSettings {
    return {
        apiKey: secret.apiKey,
        hasApiKey: secret.apiKey.length > 0,
        updatedAt,
    };
}

function parseOpenAiSettings(secretJson: string): StoredOpenAiSettings {
    try {
        const parsed = JSON.parse(secretJson) as Partial<StoredOpenAiSettings>;
        return { apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : '' };
    } catch {
        return { apiKey: '' };
    }
}

async function readJson(request: Request): Promise<unknown> {
    return await request.json().catch(() => ({}));
}

async function refreshOpenAiDependentSchedules(): Promise<void> {
    try {
        const { refreshRuntimeCapabilities } = await import('../capabilities/store');
        const { reconcileRuntimeJobSchedules } = await import('../jobs/manager');
        await refreshRuntimeCapabilities({
            ids: ['embeddingModel', 'cortexImportProcessors', 'cortexModelAccess'],
        });
        await reconcileRuntimeJobSchedules();
    } catch (error) {
        log.warn('OpenAI model access changed, but capability refresh failed', { err: error });
    }
}
