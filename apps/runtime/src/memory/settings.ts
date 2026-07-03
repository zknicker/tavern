import {
    type AgentRuntimeMemorySettings,
    type AgentRuntimeSaveMemorySettings,
    agentRuntimeMemorySettingsSchema,
    agentRuntimeMutationHeaders,
    agentRuntimeMutationOrigins,
    agentRuntimeRoutes,
    agentRuntimeSaveMemorySettingsResultSchema,
    agentRuntimeSaveMemorySettingsSchema,
} from '@tavern/api';
import { signalAgentSettingsApplied } from '../agent-engine/settings-apply.ts';
import { getDb } from '../db/connection.ts';
import { namedParams } from '../db/sqlite.ts';
import { forbidden, json } from '../tavern/http.ts';

const memorySettingsMetadataKey = 'memory:settings';

export async function handleMemorySettingsRequest(request: Request): Promise<Response | null> {
    const url = new URL(request.url);
    if (url.pathname !== agentRuntimeRoutes.memorySettings) {
        return null;
    }

    if (request.method === 'GET') {
        return json(agentRuntimeMemorySettingsSchema.parse(getMemorySettings()));
    }
    if (request.method === 'PUT') {
        const forbiddenResponse = requireTavernMutation(request, 'Memory settings');
        if (forbiddenResponse) {
            return forbiddenResponse;
        }
        const input = agentRuntimeSaveMemorySettingsSchema.parse(
            await request.json().catch(() => ({}))
        );
        const settings = saveMemorySettings(input);
        const restartScheduled = signalAgentSettingsApplied();

        return json(
            agentRuntimeSaveMemorySettingsResultSchema.parse({ ...settings, restartScheduled })
        );
    }

    return null;
}

function requireTavernMutation(request: Request, label: string) {
    if (
        request.headers.get(agentRuntimeMutationHeaders.origin) ===
        agentRuntimeMutationOrigins.tavern
    ) {
        return null;
    }

    return forbidden(`${label} can only be changed by Tavern.`);
}

export function getMemorySettings(): AgentRuntimeMemorySettings {
    const row = getDb()
        .prepare('SELECT value, updated_at FROM runtime_metadata WHERE key = $key')
        .get(namedParams({ key: memorySettingsMetadataKey })) as
        | { updated_at: string; value: string }
        | undefined;

    if (!row) {
        return {
            enabled: true,
            updatedAt: null,
        };
    }

    return parseStoredSettings(row.value, row.updated_at);
}

export function isMemoryEnabled() {
    return getMemorySettings().enabled;
}

function saveMemorySettings(input: AgentRuntimeSaveMemorySettings): AgentRuntimeMemorySettings {
    const current = getMemorySettings();
    const next = {
        enabled: input.enabled ?? current.enabled,
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
                key: memorySettingsMetadataKey,
                now,
                value: JSON.stringify(next),
            })
        );

    return { ...next, updatedAt: now };
}

function parseStoredSettings(value: string, updatedAt: string): AgentRuntimeMemorySettings {
    const parsed = agentRuntimeMemorySettingsSchema
        .omit({ updatedAt: true })
        .safeParse(JSON.parse(value));

    if (!parsed.success) {
        throw new Error('Stored Memory settings are invalid; re-save them.');
    }

    return { ...parsed.data, updatedAt };
}
