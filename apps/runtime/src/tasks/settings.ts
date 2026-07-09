import {
    type AgentRuntimeAutoDispatchSettings,
    type AgentRuntimeSaveAutoDispatchSettings,
    agentRuntimeAutoDispatchSettingsSchema,
    agentRuntimeRoutes,
    agentRuntimeSaveAutoDispatchSettingsSchema,
} from '@tavern/api';
import { getDb } from '../db/connection.ts';
import type { Database } from '../db/sqlite.ts';
import { namedParams } from '../db/sqlite.ts';
import { json } from '../tavern/http.ts';

const settingsKey = 'runtime:auto-dispatch';

export async function handleAutoDispatchSettingsRequest(
    request: Request
): Promise<Response | null> {
    if (new URL(request.url).pathname !== agentRuntimeRoutes.taskDispatchSettings) {
        return null;
    }
    if (request.method === 'GET') {
        return json(agentRuntimeAutoDispatchSettingsSchema.parse(getAutoDispatchSettings()));
    }
    if (request.method === 'PUT') {
        const input = agentRuntimeSaveAutoDispatchSettingsSchema.parse(
            await request.json().catch(() => ({}))
        );
        return json(agentRuntimeAutoDispatchSettingsSchema.parse(saveAutoDispatchSettings(input)));
    }
    return null;
}

export function getAutoDispatchSettings(db: Database = getDb()): AgentRuntimeAutoDispatchSettings {
    const row = db
        .prepare('SELECT value, updated_at FROM runtime_metadata WHERE key = $key')
        .get(namedParams({ key: settingsKey })) as
        | { updated_at: string; value: string }
        | undefined;
    if (!row) {
        return defaults(null);
    }
    try {
        const value = JSON.parse(row.value) as Record<string, unknown>;
        return agentRuntimeAutoDispatchSettingsSchema.parse({
            autoDispatchConcurrency:
                typeof value.autoDispatchConcurrency === 'number'
                    ? value.autoDispatchConcurrency
                    : 1,
            autoDispatchEnabled: value.autoDispatchEnabled === true,
            updatedAt: row.updated_at,
        });
    } catch {
        return defaults(row.updated_at);
    }
}

export function saveAutoDispatchSettings(
    input: AgentRuntimeSaveAutoDispatchSettings,
    db: Database = getDb()
): AgentRuntimeAutoDispatchSettings {
    const current = getAutoDispatchSettings(db);
    const next = {
        autoDispatchConcurrency: input.autoDispatchConcurrency ?? current.autoDispatchConcurrency,
        autoDispatchEnabled: input.autoDispatchEnabled ?? current.autoDispatchEnabled,
    };
    const now = new Date().toISOString();
    db.prepare(
        `INSERT INTO runtime_metadata (key, value, updated_at)
         VALUES ($key, $value, $now)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    ).run(namedParams({ key: settingsKey, now, value: JSON.stringify(next) }));
    return { ...next, updatedAt: now };
}

function defaults(updatedAt: string | null): AgentRuntimeAutoDispatchSettings {
    return { autoDispatchConcurrency: 1, autoDispatchEnabled: false, updatedAt };
}
