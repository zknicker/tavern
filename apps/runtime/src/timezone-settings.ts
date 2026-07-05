import {
    type AgentRuntimeSaveTimezoneSettings,
    type AgentRuntimeTimezoneSettings,
    agentRuntimeRoutes,
    agentRuntimeSaveTimezoneSettingsResultSchema,
    agentRuntimeSaveTimezoneSettingsSchema,
    agentRuntimeTimezoneSettingsSchema,
} from '@tavern/api';
import { signalAgentSettingsApplied } from './agent-engine/settings-apply';
import { TIMEZONE } from './config';
import { getDb } from './db/connection';
import { namedParams } from './db/sqlite';
import { badRequest, json } from './tavern/http';
import { isValidTimezone } from './timezone';

const timezoneSettingsMetadataKey = 'runtime:timezone';

export async function handleTimezoneSettingsRequest(request: Request): Promise<Response | null> {
    const url = new URL(request.url);
    if (url.pathname !== agentRuntimeRoutes.timezoneSettings) {
        return null;
    }

    if (request.method === 'GET') {
        return json(agentRuntimeTimezoneSettingsSchema.parse(getTimezoneSettings()));
    }
    if (request.method === 'PUT') {
        const input = agentRuntimeSaveTimezoneSettingsSchema.parse(
            await request.json().catch(() => ({}))
        );
        if (input.timezone && !isValidTimezone(input.timezone)) {
            return badRequest(`"${input.timezone}" is not a valid IANA timezone.`);
        }

        const settings = saveTimezoneSettings(input);
        const restartScheduled = signalAgentSettingsApplied();

        return json(
            agentRuntimeSaveTimezoneSettingsResultSchema.parse({ ...settings, restartScheduled })
        );
    }

    return null;
}

export function getTimezoneSettings(): AgentRuntimeTimezoneSettings {
    const row = getDb()
        .prepare('SELECT value, updated_at FROM runtime_metadata WHERE key = $key')
        .get(namedParams({ key: timezoneSettingsMetadataKey })) as
        | { updated_at: string; value: string }
        | undefined;

    if (!row) {
        return withResolved({ timezone: null, updatedAt: null });
    }

    return parseStoredSettings(row.value, row.updated_at);
}

/**
 * The home timezone every timezone-aware runtime consumer shares: the
 * configured setting, else the runtime host timezone, else UTC.
 */
export function resolveHomeTimezone(): string {
    const configured = getTimezoneSettings().timezone;
    return configured && isValidTimezone(configured) ? configured : TIMEZONE;
}

function saveTimezoneSettings(
    input: AgentRuntimeSaveTimezoneSettings
): AgentRuntimeTimezoneSettings {
    const current = getTimezoneSettings();
    const next = {
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
                key: timezoneSettingsMetadataKey,
                now,
                value: JSON.stringify(next),
            })
        );

    return withResolved({ timezone: next.timezone, updatedAt: now });
}

function parseStoredSettings(value: string, updatedAt: string): AgentRuntimeTimezoneSettings {
    try {
        const parsed = JSON.parse(value) as { timezone?: unknown };
        const timezone = typeof parsed.timezone === 'string' ? parsed.timezone : null;
        return withResolved({ timezone, updatedAt });
    } catch {
        return withResolved({ timezone: null, updatedAt });
    }
}

function withResolved(settings: {
    timezone: null | string;
    updatedAt: null | string;
}): AgentRuntimeTimezoneSettings {
    const { timezone } = settings;
    return {
        ...settings,
        resolvedTimezone: timezone && isValidTimezone(timezone) ? timezone : TIMEZONE,
    };
}
