import {
    type AgentRuntimeExecutionSettings,
    type AgentRuntimeSaveExecutionSettings,
    agentRuntimeExecutionSettingsSchema,
    agentRuntimeRoutes,
    agentRuntimeSaveExecutionSettingsResultSchema,
    agentRuntimeSaveExecutionSettingsSchema,
} from '@tavern/api';
import { getDb } from '../db/connection';
import { namedParams } from '../db/sqlite';
import { badRequest, json } from '../tavern/http';
import { isValidTimezone } from '../timezone';
import { writeManagedHermesConfigFile } from './model-config';
import { requestManagedHermesRestart } from './supervisor';

const executionSettingsMetadataKey = 'hermes:execution-settings';

export async function handleExecutionSettingsRequest(request: Request): Promise<Response | null> {
    const url = new URL(request.url);
    if (url.pathname !== agentRuntimeRoutes.executionSettings) {
        return null;
    }

    if (request.method === 'GET') {
        return json(agentRuntimeExecutionSettingsSchema.parse(getHermesExecutionSettings()));
    }
    if (request.method === 'PUT') {
        const input = agentRuntimeSaveExecutionSettingsSchema.parse(
            await request.json().catch(() => ({}))
        );
        if (input.timezone && !isValidTimezone(input.timezone)) {
            return badRequest(`"${input.timezone}" is not a valid IANA timezone.`);
        }

        const settings = saveHermesExecutionSettings(input);
        await writeManagedHermesConfigFile();
        const restartScheduled = requestManagedHermesRestart();

        return json(
            agentRuntimeSaveExecutionSettingsResultSchema.parse({ ...settings, restartScheduled })
        );
    }

    return null;
}

export function getHermesExecutionSettings(): AgentRuntimeExecutionSettings {
    const row = getDb()
        .prepare('SELECT value, updated_at FROM runtime_metadata WHERE key = $key')
        .get(namedParams({ key: executionSettingsMetadataKey })) as
        | { updated_at: string; value: string }
        | undefined;

    if (!row) {
        return { fallbackModels: [], timezone: null, updatedAt: null };
    }

    return parseStoredSettings(row.value, row.updated_at);
}

function saveHermesExecutionSettings(
    input: AgentRuntimeSaveExecutionSettings
): AgentRuntimeExecutionSettings {
    const current = getHermesExecutionSettings();
    const next = {
        fallbackModels: input.fallbackModels ?? current.fallbackModels,
        timezone: input.timezone === undefined ? current.timezone : input.timezone,
    };

    const now = new Date().toISOString();
    getDb()
        .prepare(
            `INSERT INTO runtime_metadata (key, value, updated_at)
             VALUES ($key, $value, $now)
             ON CONFLICT(key) DO UPDATE SET
               value = excluded.value,
               updated_at = excluded.updated_at`
        )
        .run(
            namedParams({
                key: executionSettingsMetadataKey,
                now,
                value: JSON.stringify(next),
            })
        );

    return { ...next, updatedAt: now };
}

function parseStoredSettings(value: string, updatedAt: string): AgentRuntimeExecutionSettings {
    const parsed = agentRuntimeExecutionSettingsSchema
        .omit({ updatedAt: true })
        .safeParse(JSON.parse(value));

    if (!parsed.success) {
        throw new Error('Stored agent execution settings are invalid; re-save them.');
    }

    return { ...parsed.data, updatedAt };
}
