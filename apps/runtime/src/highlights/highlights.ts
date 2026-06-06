import {
    type AgentRuntimeCronRun,
    type AgentRuntimeHighlight,
    type AgentRuntimeHighlightCategory,
    type AgentRuntimeHighlightList,
    agentRuntimeHighlightListSchema,
} from '@tavern/api';
import type { CortexDatabase } from '../cortex/db';
import { getDb } from '../db/connection';
import type { Database } from '../db/sqlite';
import { namedParams } from '../db/sqlite';
import { buildHighlightCandidates } from './candidate-builders';
import {
    generationMetadataKey,
    generatorVersion,
    highlightTtlMs,
    hourMs,
    staleAfterMs,
} from './constants';

interface GenerateHighlightsOptions {
    cortexDb?: CortexDatabase;
    cronRuns?: AgentRuntimeCronRun[];
    db?: Database;
    now?: Date;
}

interface HighlightRow {
    category: AgentRuntimeHighlightCategory;
    expires_at: string;
    generated_at: string;
    headline: string;
    id: string;
    metric_json: string;
    receipt: string;
    source_refs_json: string;
    window_end: string;
    window_start: string;
}

export async function generateTavernHighlights(
    options: GenerateHighlightsOptions = {}
): Promise<AgentRuntimeHighlightList> {
    const db = options.db ?? getDb();
    const now = options.now ?? new Date();
    const generatedAt = now.toISOString();
    const expiresAt = new Date(now.getTime() + highlightTtlMs).toISOString();
    const slotStart = getHourSlotStart(now);
    const candidates = await buildHighlightCandidates({
        cortexDb: options.cortexDb,
        cronRuns: options.cronRuns,
        db,
        now,
        slotStart,
    });

    db.exec('BEGIN IMMEDIATE');
    try {
        db.prepare('DELETE FROM tavern_highlights WHERE expires_at <= $generatedAt').run(
            namedParams({ generatedAt })
        );
        db.prepare(
            `INSERT INTO runtime_metadata (key, value, updated_at)
             VALUES ($key, $value, $updatedAt)
             ON CONFLICT(key) DO UPDATE SET
                value = excluded.value,
                updated_at = excluded.updated_at`
        ).run(
            namedParams({
                key: generationMetadataKey,
                updatedAt: generatedAt,
                value: generatedAt,
            })
        );

        for (const candidate of candidates) {
            db.prepare(
                `INSERT INTO tavern_highlights (
                    id,
                    category,
                    headline,
                    receipt,
                    metric_json,
                    source_refs_json,
                    window_start,
                    window_end,
                    generated_at,
                    expires_at,
                    generator_version
                )
                VALUES (
                    $id,
                    $category,
                    $headline,
                    $receipt,
                    $metricJson,
                    $sourceRefsJson,
                    $windowStart,
                    $windowEnd,
                    $generatedAt,
                    $expiresAt,
                    $generatorVersion
                )
                ON CONFLICT(id) DO UPDATE SET
                    headline = excluded.headline,
                    receipt = excluded.receipt,
                    metric_json = excluded.metric_json,
                    source_refs_json = excluded.source_refs_json,
                    window_start = excluded.window_start,
                    window_end = excluded.window_end,
                    generated_at = excluded.generated_at,
                    expires_at = excluded.expires_at,
                    generator_version = excluded.generator_version`
            ).run(
                namedParams({
                    category: candidate.category,
                    expiresAt,
                    generatedAt,
                    generatorVersion,
                    headline: candidate.headline,
                    id: candidate.id,
                    metricJson: JSON.stringify(candidate.metric),
                    receipt: candidate.receipt,
                    sourceRefsJson: JSON.stringify(candidate.sourceRefs),
                    windowEnd: candidate.windowEnd,
                    windowStart: candidate.windowStart,
                })
            );
        }
        db.exec('COMMIT');
    } catch (error) {
        db.exec('ROLLBACK');
        throw error;
    }

    return listTavernHighlights({ db, now });
}

export function listTavernHighlights(
    options: { db?: Database; now?: Date } = {}
): AgentRuntimeHighlightList {
    const db = options.db ?? getDb();
    const now = options.now ?? new Date();
    const nowIso = now.toISOString();
    const rows = db
        .prepare(
            `SELECT *
             FROM tavern_highlights
             WHERE expires_at > $nowIso
             ORDER BY generated_at DESC, category ASC`
        )
        .all(namedParams({ nowIso })) as HighlightRow[];

    return agentRuntimeHighlightListSchema.parse({
        freshness: getHighlightFreshness(db, now),
        highlights: rows.map(rowToHighlight),
    });
}

function getHighlightFreshness(db: Database, now: Date): AgentRuntimeHighlightList['freshness'] {
    const metadata = db
        .prepare('SELECT value AS generated_at FROM runtime_metadata WHERE key = $key')
        .get(namedParams({ key: generationMetadataKey })) as { generated_at: string } | null;
    const latest = db
        .prepare('SELECT MAX(generated_at) AS generated_at FROM tavern_highlights')
        .get() as { generated_at: null | string };
    const generatedAt = metadata?.generated_at ?? latest.generated_at;

    if (!generatedAt) {
        return {
            generatedAt: null,
            nextRefreshAt: null,
            staleReason: null,
            status: 'empty',
        };
    }

    const generatedAtMs = Date.parse(generatedAt);
    const nextRefreshAt = new Date(generatedAtMs + hourMs).toISOString();
    const ageMs = now.getTime() - generatedAtMs;

    if (ageMs > staleAfterMs) {
        return {
            generatedAt,
            nextRefreshAt,
            staleReason: 'Highlights have not regenerated in the past 3 hours.',
            status: 'stale',
        };
    }

    const active = db
        .prepare('SELECT 1 FROM tavern_highlights WHERE expires_at > $nowIso LIMIT 1')
        .get(namedParams({ nowIso: now.toISOString() }));

    if (!active) {
        return {
            generatedAt,
            nextRefreshAt,
            staleReason: null,
            status: 'empty',
        };
    }

    return {
        generatedAt,
        nextRefreshAt,
        staleReason: null,
        status: 'fresh',
    };
}

function rowToHighlight(row: HighlightRow): AgentRuntimeHighlight {
    return {
        category: row.category,
        expiresAt: row.expires_at,
        generatedAt: row.generated_at,
        headline: row.headline,
        id: row.id,
        metric: JSON.parse(row.metric_json),
        receipt: row.receipt,
        sourceRefs: JSON.parse(row.source_refs_json),
        windowEnd: row.window_end,
        windowStart: row.window_start,
    };
}

function getHourSlotStart(now: Date) {
    return new Date(Math.floor(now.getTime() / hourMs) * hourMs);
}
