import { createHash } from 'node:crypto';
import { getDb } from '../db/connection.ts';
import { namedParams } from '../db/sqlite.ts';

export interface CachedModelCatalog {
    fingerprint: null | string;
    models: string[];
    refreshedAt: string;
    warning: null | string;
}

interface ModelCatalogCacheRow {
    expires_at: null | string;
    fingerprint: null | string;
    models_json: string;
    refreshed_at: string;
    warning: null | string;
}

export function readCachedModelCatalog(input: {
    allowExpired?: boolean;
    fingerprint?: null | string;
    providerId: string;
}): CachedModelCatalog | null {
    try {
        const row = getDb()
            .prepare('SELECT * FROM model_catalog_cache WHERE provider_id = $providerId LIMIT 1')
            .get(namedParams({ providerId: input.providerId })) as ModelCatalogCacheRow | null;
        if (!row || (input.fingerprint && row.fingerprint !== input.fingerprint)) {
            return null;
        }
        if (!input.allowExpired && row.expires_at && Date.parse(row.expires_at) <= Date.now()) {
            return null;
        }

        const parsed = JSON.parse(row.models_json) as unknown;
        if (!Array.isArray(parsed)) {
            return null;
        }
        const models = parsed.filter((model): model is string => typeof model === 'string');
        return {
            fingerprint: row.fingerprint,
            models,
            refreshedAt: row.refreshed_at,
            warning: row.warning,
        };
    } catch {
        return null;
    }
}

export function writeCachedModelCatalog(input: {
    expiresAt?: null | string;
    fingerprint?: null | string;
    models: string[];
    providerId: string;
    sourceKind: string;
    warning?: null | string;
}): void {
    if (input.models.length === 0) {
        return;
    }

    try {
        const refreshedAt = new Date().toISOString();
        getDb()
            .prepare(
                `
                INSERT INTO model_catalog_cache (
                    provider_id,
                    source_kind,
                    models_json,
                    warning,
                    refreshed_at,
                    expires_at,
                    fingerprint
                )
                VALUES (
                    $providerId,
                    $sourceKind,
                    $modelsJson,
                    $warning,
                    $refreshedAt,
                    $expiresAt,
                    $fingerprint
                )
                ON CONFLICT(provider_id) DO UPDATE SET
                    source_kind = excluded.source_kind,
                    models_json = excluded.models_json,
                    warning = excluded.warning,
                    refreshed_at = excluded.refreshed_at,
                    expires_at = excluded.expires_at,
                    fingerprint = excluded.fingerprint
            `
            )
            .run(
                namedParams({
                    expiresAt: input.expiresAt ?? null,
                    fingerprint: input.fingerprint ?? null,
                    modelsJson: JSON.stringify(input.models),
                    providerId: input.providerId,
                    refreshedAt,
                    sourceKind: input.sourceKind,
                    warning: input.warning ?? null,
                })
            );
    } catch {
        // Catalog cache is an optimization. Provider sources still return their
        // authored rows or live result when storage is unavailable.
    }
}

export function modelCatalogFingerprint(parts: Array<null | string | undefined>) {
    return createHash('sha256')
        .update(parts.map((part) => part ?? '').join('\0'))
        .digest('hex')
        .slice(0, 16);
}

export function modelCatalogExpiry(ttlMs: number) {
    return new Date(Date.now() + ttlMs).toISOString();
}
