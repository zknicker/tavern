import {
    type AgentRuntimeModelCategory,
    type AgentRuntimeModelCategorySettings,
    type AgentRuntimeModelName,
    type AgentRuntimeSaveModelCategorySettings,
    agentRuntimeModelCategorySettingsSchema,
    agentRuntimeMutationHeaders,
    agentRuntimeMutationOrigins,
    agentRuntimeRoutes,
    agentRuntimeSaveModelCategorySettingsResultSchema,
    agentRuntimeSaveModelCategorySettingsSchema,
} from '@tavern/api';
import { getDb } from '../db/connection.ts';
import { namedParams } from '../db/sqlite.ts';
import { forbidden, json } from '../tavern/http.ts';
import { defaultWorkerModelSelection } from './selection-service.ts';

const modelCategorySettingsMetadataKey = 'models:category-settings';

const defaultCategories: AgentRuntimeModelCategorySettings['categories'] = {
    fast: null,
    standard: null,
    deep: null,
    visual: null,
};

export async function handleModelCategorySettingsRequest(
    request: Request
): Promise<Response | null> {
    const url = new URL(request.url);
    if (url.pathname !== agentRuntimeRoutes.modelCategorySettings) {
        return null;
    }

    if (request.method === 'GET') {
        return json(agentRuntimeModelCategorySettingsSchema.parse(getModelCategorySettings()));
    }
    if (request.method === 'PUT') {
        const forbiddenResponse = requireTavernMutation(request, 'Model category settings');
        if (forbiddenResponse) {
            return forbiddenResponse;
        }
        const input = agentRuntimeSaveModelCategorySettingsSchema.parse(
            await request.json().catch(() => ({}))
        );
        const settings = saveModelCategorySettings(input);
        // Lazy import: capabilities/definitions imports this module.
        void import('../capabilities/store.ts')
            .then((store) =>
                store.refreshRuntimeCapabilities({ ids: ['memoryWorkers'], publishUpdated: true })
            )
            .catch(() => {});

        return json(
            agentRuntimeSaveModelCategorySettingsResultSchema.parse({
                ...settings,
                restartScheduled: false,
            })
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

export function getModelCategorySettings(): AgentRuntimeModelCategorySettings {
    const row = getDb()
        .prepare('SELECT value, updated_at FROM runtime_metadata WHERE key = $key')
        .get(namedParams({ key: modelCategorySettingsMetadataKey })) as
        | { updated_at: string; value: string }
        | undefined;

    if (!row) {
        return {
            categories: defaultCategories,
            updatedAt: null,
        };
    }

    return parseStoredSettings(row.value, row.updated_at);
}

export function resolveModelCategorySelection(category: AgentRuntimeModelCategory) {
    return getModelCategorySettings().categories[category] ?? defaultWorkerModelSelection();
}

function saveModelCategorySettings(
    input: AgentRuntimeSaveModelCategorySettings
): AgentRuntimeModelCategorySettings {
    const current = getModelCategorySettings();
    const next = {
        categories: {
            ...current.categories,
            ...input.categories,
        },
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
                key: modelCategorySettingsMetadataKey,
                now,
                value: JSON.stringify(next),
            })
        );

    return { ...next, updatedAt: now };
}

function parseStoredSettings(value: string, updatedAt: string): AgentRuntimeModelCategorySettings {
    const parsed = agentRuntimeModelCategorySettingsSchema
        .omit({ updatedAt: true })
        .safeParse(JSON.parse(value));

    if (!parsed.success) {
        throw new Error('Stored model category settings are invalid; re-save them.');
    }

    return {
        categories: {
            ...defaultCategories,
            ...parsed.data.categories,
        },
        updatedAt,
    };
}

export function modelCategoryModelRef(model: AgentRuntimeModelName) {
    return `${model.provider}/${model.model}`;
}
