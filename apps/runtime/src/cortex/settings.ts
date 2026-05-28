import type { CortexSaveSettings, CortexSettings } from '@tavern/api';
import { readConfigValue } from '../config';
import type { Database } from '../db/sqlite';
import { namedParams } from '../db/sqlite';
import { nowIso, readJsonRecord } from './rows';

export const cortexEmbeddingProvider = 'openai';
export const defaultCortexEmbeddingModel = 'text-embedding-3-small';
export const defaultCortexRecallMode = 'balanced';

const embeddingSettingsKey = 'embedding';
const recallSettingsKey = 'recall';

type CortexEmbeddingModel = CortexSettings['embedding']['model'];
type CortexRecallMode = CortexSettings['recall']['mode'];

const cortexEmbeddingDimensionsByModel: Record<CortexEmbeddingModel, number> = {
    'text-embedding-3-large': 3072,
    'text-embedding-3-small': 1536,
};

interface StoredEmbeddingSettings {
    apiKey?: string;
    model?: string;
    provider?: string;
    updatedAt?: string;
}

interface StoredRecallSettings {
    mode?: string;
    updatedAt?: string;
}

export function getCortexSettings(db: Database): CortexSettings {
    const storedEmbedding = readStoredEmbeddingSettings(db);
    const storedRecall = readStoredRecallSettings(db);
    const envApiKey = readConfigValue('OPENAI_API_KEY');
    const storedApiKey = storedEmbedding.apiKey?.trim() || null;
    const model = normalizeCortexEmbeddingModel(storedEmbedding.model);

    return {
        embedding: {
            apiKey: envApiKey ?? storedApiKey,
            apiKeyConfigured: Boolean(envApiKey || storedApiKey),
            apiKeySource: envApiKey ? 'environment' : storedApiKey ? 'runtime-settings' : null,
            dimensions: getCortexEmbeddingDimensions(model),
            model,
            provider: cortexEmbeddingProvider,
            updatedAt: storedEmbedding.updatedAt ?? null,
        },
        recall: {
            mode: normalizeCortexRecallMode(storedRecall.mode),
            updatedAt: storedRecall.updatedAt ?? null,
        },
    };
}

export function resolveCortexEmbeddingApiKey(db: Database): string | null {
    return (
        readConfigValue('OPENAI_API_KEY') ?? readStoredEmbeddingSettings(db).apiKey?.trim() ?? null
    );
}

export function getCortexEmbeddingConfig(db: Database) {
    const settings = getCortexSettings(db).embedding;
    return {
        apiKey: resolveCortexEmbeddingApiKey(db),
        dimensions: settings.dimensions,
        model: settings.model,
        provider: settings.provider,
    };
}

export function saveCortexSettings(db: Database, input: CortexSaveSettings): CortexSettings {
    const timestamp = nowIso();
    const current = readStoredEmbeddingSettings(db);
    const next: StoredEmbeddingSettings = {
        apiKey: input.embedding.apiKey ?? current.apiKey,
        model: input.embedding.model,
        provider: cortexEmbeddingProvider,
        updatedAt: timestamp,
    };

    writeSetting(db, embeddingSettingsKey, next, timestamp);
    if (input.recall) {
        writeSetting(
            db,
            recallSettingsKey,
            {
                mode: input.recall.mode,
                updatedAt: timestamp,
            },
            timestamp
        );
    }

    return getCortexSettings(db);
}

export function getCortexEmbeddingDimensions(model: CortexEmbeddingModel) {
    return cortexEmbeddingDimensionsByModel[model];
}

function normalizeCortexEmbeddingModel(value: string | undefined): CortexEmbeddingModel {
    return value && value in cortexEmbeddingDimensionsByModel
        ? (value as CortexEmbeddingModel)
        : defaultCortexEmbeddingModel;
}

function normalizeCortexRecallMode(value: string | undefined): CortexRecallMode {
    return value === 'conservative' || value === 'balanced' || value === 'tokenmax'
        ? value
        : defaultCortexRecallMode;
}

function readStoredEmbeddingSettings(db: Database): StoredEmbeddingSettings {
    const row = db
        .prepare('SELECT value_json, updated_at FROM cortex_settings WHERE key = ?')
        .get(embeddingSettingsKey) as { updated_at: string; value_json: string } | null;
    if (!row) {
        return {};
    }

    const value = readJsonRecord(row.value_json);
    return {
        apiKey: typeof value.apiKey === 'string' ? value.apiKey : undefined,
        model: typeof value.model === 'string' ? value.model : undefined,
        provider: typeof value.provider === 'string' ? value.provider : undefined,
        updatedAt: row.updated_at,
    };
}

function readStoredRecallSettings(db: Database): StoredRecallSettings {
    const row = db
        .prepare('SELECT value_json, updated_at FROM cortex_settings WHERE key = ?')
        .get(recallSettingsKey) as { updated_at: string; value_json: string } | null;
    if (!row) {
        return {};
    }

    const value = readJsonRecord(row.value_json);
    return {
        mode: typeof value.mode === 'string' ? value.mode : undefined,
        updatedAt: row.updated_at,
    };
}

function writeSetting(db: Database, key: string, value: object, updatedAt: string): void {
    db.prepare(
        `INSERT INTO cortex_settings (key, value_json, updated_at)
         VALUES ($key, $valueJson, $updatedAt)
         ON CONFLICT(key) DO UPDATE SET
           value_json = excluded.value_json,
           updated_at = excluded.updated_at`
    ).run(
        namedParams({
            key,
            updatedAt,
            valueJson: JSON.stringify(value),
        })
    );
}
