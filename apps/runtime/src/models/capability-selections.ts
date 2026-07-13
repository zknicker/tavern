import {
    type AgentRuntimeModelCapabilitySelectionSettings,
    type AgentRuntimeModelName,
    type AgentRuntimeSaveModelCapabilitySelections,
    agentRuntimeModelCapabilitySelectionSettingsSchema,
    agentRuntimeRoutes,
    agentRuntimeSaveModelCapabilitySelectionsSchema,
} from '@tavern/api';
import { getDb } from '../db/connection.ts';
import { namedParams } from '../db/sqlite.ts';
import { json } from '../tavern/http.ts';
import {
    imageGenerationMissingKeyReason,
    resolveImageGenerationApiKey,
    supportsImageModelForRuntime,
    unsupportedImageModelProviderReason,
} from './image-model.ts';
import { requireTavernSettingsMutation } from './settings-mutation.ts';

const modelCapabilitySelectionsMetadataKey = 'models:capability-selections';

const defaultSelections: AgentRuntimeModelCapabilitySelectionSettings['selections'] = {
    imageGeneration: null,
};

export async function handleModelCapabilitySelectionsRequest(
    request: Request
): Promise<Response | null> {
    const url = new URL(request.url);
    if (url.pathname !== agentRuntimeRoutes.modelCapabilitySelections) {
        return null;
    }

    if (request.method === 'GET') {
        return json(
            agentRuntimeModelCapabilitySelectionSettingsSchema.parse(getModelCapabilitySelections())
        );
    }
    if (request.method === 'PUT') {
        const forbiddenResponse = requireTavernSettingsMutation(
            request,
            'Model capability selections'
        );
        if (forbiddenResponse) {
            return forbiddenResponse;
        }
        const input = agentRuntimeSaveModelCapabilitySelectionsSchema.parse(
            await request.json().catch(() => ({}))
        );
        const settings = saveModelCapabilitySelections(input);
        refreshImageGenerationCapability();

        return json(agentRuntimeModelCapabilitySelectionSettingsSchema.parse(settings));
    }

    return null;
}

export function getModelCapabilitySelections(): AgentRuntimeModelCapabilitySelectionSettings {
    const row = getDb()
        .prepare('SELECT value, updated_at FROM runtime_metadata WHERE key = $key')
        .get(namedParams({ key: modelCapabilitySelectionsMetadataKey })) as
        | { updated_at: string; value: string }
        | undefined;

    if (!row) {
        return {
            selections: defaultSelections,
            updatedAt: null,
        };
    }

    return parseStoredSelections(row.value, row.updated_at);
}

export function saveModelCapabilitySelections(
    input: AgentRuntimeSaveModelCapabilitySelections
): AgentRuntimeModelCapabilitySelectionSettings {
    const current = getModelCapabilitySelections();
    const next = {
        selections: {
            ...current.selections,
            ...input.selections,
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
                key: modelCapabilitySelectionsMetadataKey,
                now,
                value: JSON.stringify(next),
            })
        );

    return { ...next, updatedAt: now };
}

export function resolveImageGenerationSelection(): AgentRuntimeModelName | null {
    return getModelCapabilitySelections().selections.imageGeneration;
}

export function imageGenerationReadiness():
    | { model: AgentRuntimeModelName; ready: true }
    | { ready: false; reason: string } {
    const model = resolveImageGenerationSelection();
    if (!model) {
        return { ready: false, reason: 'No image generation model is selected.' };
    }
    if (!supportsImageModelForRuntime(model)) {
        return { ready: false, reason: unsupportedImageModelProviderReason(model.provider) };
    }
    if (!resolveImageGenerationApiKey()) {
        return { ready: false, reason: imageGenerationMissingKeyReason };
    }
    return { model, ready: true };
}

function parseStoredSelections(
    value: string,
    updatedAt: string
): AgentRuntimeModelCapabilitySelectionSettings {
    const parsed = agentRuntimeModelCapabilitySelectionSettingsSchema
        .omit({ updatedAt: true })
        .safeParse(JSON.parse(value));

    if (!parsed.success) {
        throw new Error('Stored model capability selections are invalid; re-save them.');
    }

    return {
        selections: {
            ...defaultSelections,
            ...parsed.data.selections,
        },
        updatedAt,
    };
}

function refreshImageGenerationCapability() {
    void import('../capabilities/store.ts')
        .then((store) =>
            store.refreshRuntimeCapabilities({
                ids: ['imageGeneration'],
                publishUpdated: true,
            })
        )
        .catch(() => {});
}
