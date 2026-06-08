import type { CortexSaveSettings, CortexSettings } from '@tavern/api';
import { readConfigValue } from '../config';
import {
    getOpenAiApiKey,
    getOpenAiSettings,
    saveOpenAiSettings,
} from '../model-access/openai-settings';
import type { CortexDatabase } from './db';
import { nowIso, readJsonRecord } from './rows';

export const cortexEmbeddingProvider = 'openai';
export const defaultCortexEmbeddingModel = 'text-embedding-3-small';
export const defaultCortexEmbeddingModelRef = 'openai/text-embedding-3-small';
export const defaultCortexQueryExpansionModelRef = 'openrouter/google/gemini-2.5-flash-lite';
export const defaultCortexDreamModelRef = 'openai-codex/gpt-5.5';
export const defaultCortexChatIngestionModelRef = 'openai-codex/gpt-5.5';
export const defaultCortexAudioTranscriptionModelRef = 'openai/whisper-1';
export const defaultCortexOcrModelRef = 'openai/gpt-4o-mini';
export const defaultCortexRecallMode = 'balanced';

const embeddingSettingsKey = 'embedding';
const modelsSettingsKey = 'models';
const recallSettingsKey = 'recall';

type CortexEmbeddingModel = CortexSettings['embedding']['model'];
type CortexRecallMode = CortexSettings['recall']['mode'];
type CortexModelProvider = 'openai-codex' | 'openai' | 'openrouter';

const cortexEmbeddingDimensionsByModel: Record<CortexEmbeddingModel, number> = {
    'text-embedding-3-large': 3072,
    'text-embedding-3-small': 1536,
};

export const cortexEmbeddingVectorDimensions = getCortexEmbeddingDimensions(
    defaultCortexEmbeddingModel
);

interface StoredEmbeddingSettings {
    apiKey?: string;
    model?: string;
    modelRef?: string;
    provider?: string;
    updatedAt?: string;
}

interface StoredModelSettings {
    audioTranscription?: string;
    chatIngestion?: string;
    dream?: string;
    embedding?: string;
    ocr?: string;
    queryExpansion?: string;
    updatedAt?: string;
}

interface StoredRecallSettings {
    mode?: string;
    updatedAt?: string;
}

export async function getCortexSettings(db: CortexDatabase): Promise<CortexSettings> {
    const storedEmbedding = await readStoredEmbeddingSettings(db);
    const storedModels = await readStoredModelSettings(db);
    const storedRecall = await readStoredRecallSettings(db);
    const envApiKey = readConfigValue('OPENAI_API_KEY');
    const vaultSettings = readOpenAiSettingsOrEmpty();
    const modelRef = normalizeCortexEmbeddingModelRef(
        storedModels.embedding ?? storedEmbedding.modelRef
    );
    const model = modelFromEmbeddingRef(modelRef);

    return {
        embedding: {
            apiKey: null,
            apiKeyConfigured: Boolean(envApiKey || vaultSettings.hasApiKey),
            apiKeySource: envApiKey
                ? 'environment'
                : vaultSettings.hasApiKey
                  ? 'runtime-settings'
                  : null,
            dimensions: getCortexEmbeddingDimensions(model),
            model,
            modelRef,
            provider: cortexEmbeddingProvider,
            updatedAt: storedEmbedding.updatedAt ?? null,
        },
        models: {
            audioTranscription: normalizeRunnableModelRef(
                storedModels.audioTranscription,
                defaultCortexAudioTranscriptionModelRef,
                'openai'
            ),
            dream: normalizeRunnableModelRef(
                storedModels.dream,
                defaultCortexDreamModelRef,
                'openai-codex'
            ),
            embedding: modelRef,
            ocr: normalizeRunnableModelRef(storedModels.ocr, defaultCortexOcrModelRef, 'openai'),
            queryExpansion: normalizeRunnableModelRef(
                storedModels.queryExpansion,
                defaultCortexQueryExpansionModelRef,
                'openrouter'
            ),
            chatIngestion: normalizeRunnableModelRef(
                storedModels.chatIngestion,
                defaultCortexChatIngestionModelRef,
                'openai-codex'
            ),
        },
        recall: {
            mode: normalizeCortexRecallMode(storedRecall.mode),
            updatedAt: storedRecall.updatedAt ?? null,
        },
    };
}

export async function resolveCortexEmbeddingApiKey(_db: CortexDatabase): Promise<string | null> {
    return await resolveCortexOpenAiApiKey();
}

export async function resolveCortexOpenAiApiKey(): Promise<string | null> {
    return readConfigValue('OPENAI_API_KEY') ?? getOpenAiApiKey();
}

export async function getCortexEmbeddingConfig(db: CortexDatabase) {
    const settings = (await getCortexSettings(db)).embedding;
    return {
        apiKey: await resolveCortexEmbeddingApiKey(db),
        dimensions: settings.dimensions,
        model: settings.model,
        provider: settings.provider,
    };
}

export async function saveCortexSettings(
    db: CortexDatabase,
    input: CortexSaveSettings
): Promise<CortexSettings> {
    if (input.embedding.model === 'text-embedding-3-large') {
        throw new Error(
            `Cortex PGLite is initialized for ${cortexEmbeddingVectorDimensions}-dimension embeddings. text-embedding-3-large uses ${getCortexEmbeddingDimensions('text-embedding-3-large')} dimensions.`
        );
    }
    const embeddingModelRef = normalizeCortexEmbeddingModelRef(
        input.models?.embedding ?? input.embedding.modelRef ?? `openai/${input.embedding.model}`
    );
    const embeddingModel = modelFromEmbeddingRef(embeddingModelRef);
    const dimensions = getCortexEmbeddingDimensions(embeddingModel);
    if (dimensions !== cortexEmbeddingVectorDimensions) {
        throw new Error(
            `Cortex PGLite is initialized for ${cortexEmbeddingVectorDimensions}-dimension embeddings. ${embeddingModel} uses ${dimensions} dimensions.`
        );
    }

    const timestamp = nowIso();
    const current = await readStoredEmbeddingSettings(db);
    const currentModels = await readStoredModelSettings(db);
    if (input.embedding.apiKey) {
        saveOpenAiSettings({ apiKey: input.embedding.apiKey });
    }
    const next: StoredEmbeddingSettings = {
        apiKey: current.apiKey,
        model: embeddingModel,
        modelRef: embeddingModelRef,
        provider: cortexEmbeddingProvider,
        updatedAt: timestamp,
    };

    await writeSetting(db, embeddingSettingsKey, next, timestamp);
    await writeSetting(
        db,
        modelsSettingsKey,
        {
            audioTranscription: normalizeRunnableModelRef(
                input.models?.audioTranscription ?? currentModels.audioTranscription,
                defaultCortexAudioTranscriptionModelRef,
                'openai'
            ),
            dream: normalizeRunnableModelRef(
                input.models?.dream ?? currentModels.dream,
                defaultCortexDreamModelRef,
                'openai-codex'
            ),
            embedding: embeddingModelRef,
            ocr: normalizeRunnableModelRef(
                input.models?.ocr ?? currentModels.ocr,
                defaultCortexOcrModelRef,
                'openai'
            ),
            queryExpansion: normalizeRunnableModelRef(
                input.models?.queryExpansion ?? currentModels.queryExpansion,
                defaultCortexQueryExpansionModelRef,
                'openrouter'
            ),
            chatIngestion: normalizeRunnableModelRef(
                input.models?.chatIngestion ?? currentModels.chatIngestion,
                defaultCortexChatIngestionModelRef,
                'openai-codex'
            ),
            updatedAt: timestamp,
        },
        timestamp
    );
    if (input.recall) {
        await writeSetting(
            db,
            recallSettingsKey,
            {
                mode: input.recall.mode,
                updatedAt: timestamp,
            },
            timestamp
        );
    }

    return await getCortexSettings(db);
}

export async function ensureDefaultCortexSettings(db: CortexDatabase): Promise<void> {
    const timestamp = nowIso();
    await writeDefaultSetting(
        db,
        embeddingSettingsKey,
        {
            model: defaultCortexEmbeddingModel,
            modelRef: defaultCortexEmbeddingModelRef,
            provider: cortexEmbeddingProvider,
            updatedAt: timestamp,
        },
        timestamp
    );
    await writeDefaultSetting(
        db,
        modelsSettingsKey,
        {
            audioTranscription: defaultCortexAudioTranscriptionModelRef,
            dream: defaultCortexDreamModelRef,
            embedding: defaultCortexEmbeddingModelRef,
            ocr: defaultCortexOcrModelRef,
            queryExpansion: defaultCortexQueryExpansionModelRef,
            chatIngestion: defaultCortexChatIngestionModelRef,
            updatedAt: timestamp,
        },
        timestamp
    );
    await writeDefaultSetting(
        db,
        recallSettingsKey,
        {
            mode: defaultCortexRecallMode,
            updatedAt: timestamp,
        },
        timestamp
    );
}

export function getCortexEmbeddingDimensions(model: CortexEmbeddingModel) {
    return cortexEmbeddingDimensionsByModel[model];
}

function normalizeCortexEmbeddingModel(value: string | undefined): CortexEmbeddingModel {
    return value && value in cortexEmbeddingDimensionsByModel
        ? (value as CortexEmbeddingModel)
        : defaultCortexEmbeddingModel;
}

function readOpenAiSettingsOrEmpty() {
    try {
        return getOpenAiSettings();
    } catch {
        return {
            apiKey: '',
            hasApiKey: false,
            updatedAt: null,
        };
    }
}

function normalizeCortexEmbeddingModelRef(
    value: string | undefined
): typeof defaultCortexEmbeddingModelRef {
    return value === defaultCortexEmbeddingModelRef ? value : defaultCortexEmbeddingModelRef;
}

function modelFromEmbeddingRef(value: string): CortexEmbeddingModel {
    return normalizeCortexEmbeddingModel(value.split('/').at(-1));
}

function normalizeChatModelRef(value: string | undefined, fallback: string) {
    const trimmed = value?.trim();
    return trimmed && /^[a-z0-9][a-z0-9-]*\/[A-Za-z0-9._:/-]+$/u.test(trimmed) ? trimmed : fallback;
}

function normalizeRunnableModelRef(
    value: string | undefined,
    fallback: string,
    provider: CortexModelProvider
) {
    const normalized = normalizeChatModelRef(value, fallback);
    return normalized.startsWith(`${provider}/`) ? normalized : fallback;
}

function normalizeCortexRecallMode(value: string | undefined): CortexRecallMode {
    return value === 'conservative' || value === 'balanced' || value === 'tokenmax'
        ? value
        : defaultCortexRecallMode;
}

async function readStoredEmbeddingSettings(db: CortexDatabase): Promise<StoredEmbeddingSettings> {
    const row = await db
        .prepare('SELECT value_json, updated_at FROM cortex_settings WHERE key = ?')
        .get<{ updated_at: string; value_json: string }>(embeddingSettingsKey);
    if (!row) {
        return {};
    }

    const value = readJsonRecord(row.value_json);
    return {
        apiKey: typeof value.apiKey === 'string' ? value.apiKey : undefined,
        model: typeof value.model === 'string' ? value.model : undefined,
        modelRef: typeof value.modelRef === 'string' ? value.modelRef : undefined,
        provider: typeof value.provider === 'string' ? value.provider : undefined,
        updatedAt: row.updated_at,
    };
}

async function readStoredModelSettings(db: CortexDatabase): Promise<StoredModelSettings> {
    const row = await db
        .prepare('SELECT value_json, updated_at FROM cortex_settings WHERE key = ?')
        .get<{ updated_at: string; value_json: string }>(modelsSettingsKey);
    if (!row) {
        return {};
    }

    const value = readJsonRecord(row.value_json);
    return {
        audioTranscription:
            typeof value.audioTranscription === 'string' ? value.audioTranscription : undefined,
        dream: typeof value.dream === 'string' ? value.dream : undefined,
        chatIngestion: typeof value.chatIngestion === 'string' ? value.chatIngestion : undefined,
        embedding: typeof value.embedding === 'string' ? value.embedding : undefined,
        ocr: typeof value.ocr === 'string' ? value.ocr : undefined,
        queryExpansion: typeof value.queryExpansion === 'string' ? value.queryExpansion : undefined,
        updatedAt: row.updated_at,
    };
}

async function readStoredRecallSettings(db: CortexDatabase): Promise<StoredRecallSettings> {
    const row = await db
        .prepare('SELECT value_json, updated_at FROM cortex_settings WHERE key = ?')
        .get<{ updated_at: string; value_json: string }>(recallSettingsKey);
    if (!row) {
        return {};
    }

    const value = readJsonRecord(row.value_json);
    return {
        mode: typeof value.mode === 'string' ? value.mode : undefined,
        updatedAt: row.updated_at,
    };
}

async function writeSetting(
    db: CortexDatabase,
    key: string,
    value: object,
    updatedAt: string
): Promise<void> {
    await db
        .prepare(
            `INSERT INTO cortex_settings (key, value_json, updated_at)
         VALUES ($key, $valueJson, $updatedAt)
         ON CONFLICT(key) DO UPDATE SET
           value_json = excluded.value_json,
           updated_at = excluded.updated_at`
        )
        .run({
            key,
            updatedAt,
            valueJson: JSON.stringify(value),
        });
}

async function writeDefaultSetting(
    db: CortexDatabase,
    key: string,
    value: object,
    updatedAt: string
): Promise<void> {
    await db
        .prepare(
            `INSERT INTO cortex_settings (key, value_json, updated_at)
         VALUES ($key, $valueJson, $updatedAt)
         ON CONFLICT(key) DO NOTHING`
        )
        .run({
            key,
            updatedAt,
            valueJson: JSON.stringify(value),
        });
}
