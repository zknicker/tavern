import type {
    CortexBacklinkList,
    CortexPage,
    CortexPageList,
    CortexRecallInput,
    CortexRecallResult,
    CortexSearchInput,
    CortexSearchResult,
    CortexSettings,
    CortexSourceRef,
    CortexStatus,
} from '@tavern/api';
import { DATA_DIR, RUNTIME_ROOT } from '../config';
import type { Database } from '../db/sqlite';
import { namedParams } from '../db/sqlite';
import { writeCortexAudit } from './audit';
import { embedCortexText } from './encoding';
import {
    type ChunkEncodingRow,
    type ClaimRow,
    type JobRunRow,
    type LinkRow,
    normalizePageLookup,
    type PageRow,
    readJsonArray,
    readJsonRecord,
    scoreLexical,
    snippet,
    type TimelineRow,
    tokenize,
    toLink,
    toPageSummary,
} from './rows';
import { getCortexSettings } from './settings';
import type { CortexVectorDatabase } from './vector-db/types';

export const cortexWikiPath = `${RUNTIME_ROOT}/cortex/wiki`;
export const cortexDatabasePath = `${DATA_DIR}/runtime.db`;

export function resolveCortexWikiPath() {
    return process.env.TAVERN_CORTEX_WIKI_PATH?.trim() || cortexWikiPath;
}

export function listCortexPages(db: Database, limit = 100): CortexPageList {
    const rows = db
        .prepare(
            `SELECT id, slug, title, type, status, frontmatter_json, updated_at
             FROM cortex_pages
             WHERE deleted_at IS NULL
             ORDER BY updated_at DESC
             LIMIT ?`
        )
        .all(limit) as PageRow[];
    return {
        pages: rows.map((row) => ({ ...toPageSummary(row), links: listPageLinks(db, row.id) })),
    };
}

export function getCortexPage(db: Database, slugOrId: string): CortexPage | null {
    const row = findPageRow(db, slugOrId);
    return row ? toPage(db, row) : null;
}

export async function searchCortex(
    db: Database,
    input: CortexSearchInput,
    vectorDatabase: CortexVectorDatabase
): Promise<CortexSearchResult> {
    const queryTerms = tokenize(input.query);
    const rows = db
        .prepare(
            `SELECT p.id AS page_id,
                    p.frontmatter_json,
                    p.title || ' ' || p.slug || ' ' || p.compiled_truth || ' ' || p.body AS score_text,
                    c.text_hash,
                    e.input_text_hash
             FROM cortex_pages p
             LEFT JOIN cortex_chunks c ON c.page_id = p.id
             LEFT JOIN cortex_encodings e ON e.chunk_id = c.id
             WHERE p.deleted_at IS NULL
               AND p.status IN ('active', 'stale')`
        )
        .all() as SearchRow[];
    const scores = new Map<string, number>();
    let vectorDegradedReason: string | null = null;

    for (const row of rows) {
        if (!matchesScope(row.frontmatter_json, input.scope)) {
            continue;
        }
        const lexical = scoreLexical(row.score_text, queryTerms);
        scores.set(row.page_id, Math.max(scores.get(row.page_id) ?? 0, lexical));
    }

    try {
        const queryEmbedding = await embedCortexText(db, input.query);
        if (queryEmbedding) {
            const vectorHits = await vectorDatabase.search({
                dimensions: queryEmbedding.dimensions,
                limit: Math.max(input.limit * 4, input.limit),
                model: queryEmbedding.model,
                provider: queryEmbedding.provider,
                vector: queryEmbedding.vector,
            });

            for (const hit of vectorHits) {
                if (!isCurrentVectorHit(db, hit.chunkId, hit.textHash)) {
                    continue;
                }
                const page = findPageRow(db, hit.pageId);
                if (!(page && matchesScope(page.frontmatter_json, input.scope))) {
                    continue;
                }
                scores.set(hit.pageId, Math.max(scores.get(hit.pageId) ?? 0, hit.score));
            }
        }
    } catch (error) {
        vectorDegradedReason = error instanceof Error ? error.message : 'Vector search failed.';
        // Lexical search remains available when the derived vector index is degraded.
    }

    const hits = Array.from(scores.entries())
        .filter(([, score]) => score > 0)
        .sort((left, right) => right[1] - left[1])
        .slice(0, input.limit)
        .flatMap(([pageId, score]) => {
            const page = findPageRow(db, pageId);
            return page
                ? [{ page: toPageSummary(page), score, snippet: snippet(page, queryTerms) }]
                : [];
        });

    return { hits, query: input.query, vectorDegradedReason };
}

type SearchRow = ChunkEncodingRow & {
    frontmatter_json: string;
    input_text_hash: string | null;
    text_hash: string | null;
};

type CortexSearchScope = NonNullable<CortexSearchInput['scope']>;

function isCurrentVectorHit(db: Database, chunkId: string, textHash: string): boolean {
    const row = db
        .prepare(
            `SELECT c.text_hash, e.input_text_hash
             FROM cortex_chunks c
             JOIN cortex_encodings e ON e.chunk_id = c.id
             WHERE c.id = ?
             LIMIT 1`
        )
        .get(chunkId) as { input_text_hash: string; text_hash: string } | null;
    return Boolean(row && row.text_hash === textHash && row.input_text_hash === row.text_hash);
}

function matchesScope(frontmatterJson: string, scope: CortexSearchInput['scope']): boolean {
    const pageScope = toRecord(readJsonRecord(frontmatterJson).scope);
    const scopeEntries = Object.entries(pageScope).filter(
        (entry): entry is [keyof CortexSearchScope, string] =>
            isScopeKey(entry[0]) && typeof entry[1] === 'string' && entry[1].length > 0
    );

    if (scopeEntries.length === 0) {
        return true;
    }

    if (!scope) {
        return true;
    }

    return scopeEntries.every(([key, value]) => scope[key] === value);
}

function isScopeKey(value: string): value is keyof CortexSearchScope {
    return ['agentId', 'chatId', 'participantId', 'profileId'].includes(value);
}

function toRecord(value: unknown): Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
}

export async function recallCortex(
    db: Database,
    input: CortexRecallInput,
    vectorDatabase: CortexVectorDatabase
): Promise<CortexRecallResult> {
    const mode = input.mode ?? getCortexSettings(db).recall.mode;
    const result = await searchCortex(db, resolveRecallSearchInput(input, mode), vectorDatabase);
    const auditId = writeCortexAudit(db, {
        kind: 'recall',
        metadata: {
            effectiveMode: mode,
            expandedQueries: [],
            requestedMode: input.mode ?? null,
            vectorDegradedReason: result.vectorDegradedReason,
        },
        recordRefs: result.hits.map((hit) => hit.page.id),
        sourceRefs: [],
        status: 'success',
        summary: `Recalled ${result.hits.length} Cortex page(s).`,
    });
    return {
        auditId,
        hits: result.hits.map((hit) => ({
            ...hit,
            evidence: getCortexPage(db, hit.page.id)?.sourceRefs ?? [],
        })),
        mode,
        query: result.query,
        requestedMode: input.mode ?? null,
        vectorDegradedReason: result.vectorDegradedReason,
    };
}

function resolveRecallSearchInput(
    input: CortexRecallInput,
    mode: CortexRecallResult['mode']
): CortexSearchInput {
    return {
        ...input,
        limit: input.limit ?? recallModeLimits[mode],
    };
}

const recallModeLimits: Record<CortexRecallResult['mode'], number> = {
    balanced: 25,
    conservative: 10,
    tokenmax: 50,
};

export function listCortexBacklinks(db: Database, target: string): CortexBacklinkList {
    const links = db
        .prepare(
            `SELECT id, from_page_id, target_slug, target_page_id, heading, label, link_kind, source_location
             FROM cortex_links
             WHERE target_slug = ? OR target_page_id = ?
             ORDER BY created_at DESC`
        )
        .all(normalizePageLookup(target), target) as LinkRow[];
    return { links: links.map(toLink), target };
}

export async function getCortexStatus(
    db: Database,
    vectorDatabase: CortexVectorDatabase
): Promise<CortexStatus> {
    const cortexSettings = getCortexSettings(db);
    return {
        auditCount: count(db, 'cortex_audit_events'),
        captureCount: count(db, 'cortex_captures'),
        chunkCount: count(db, 'cortex_chunks'),
        claimCount: count(db, 'cortex_claims'),
        databasePath: cortexDatabasePath,
        encoding: {
            currentCount: currentEncodingCount(db, cortexSettings.embedding),
            dimensions: cortexSettings.embedding.dimensions,
            model: cortexSettings.embedding.model,
            provider: cortexSettings.embedding.provider,
            staleCount: staleEncodingCount(db, cortexSettings.embedding),
            totalCount: count(db, 'cortex_encodings'),
        },
        jobRuns: listRecentJobRuns(db),
        lastCaptureAt: lastAuditAt(db, 'capture'),
        lastRecallAt: lastAuditAt(db, 'recall'),
        lastMaintenanceAt: lastAuditAt(db, 'job.maintenance'),
        linkCount: count(db, 'cortex_links'),
        pageCount: count(db, 'cortex_pages'),
        sourceCount: count(db, 'cortex_sources'),
        timelineEntryCount: count(db, 'cortex_timeline_entries'),
        vectorIndex: await withEmbeddingDegradedReason(db, vectorDatabase),
        wikiPath: resolveCortexWikiPath(),
    };
}

async function withEmbeddingDegradedReason(
    db: Database,
    vectorDatabase: CortexVectorDatabase
): Promise<CortexStatus['vectorIndex']> {
    const status = await vectorDatabase.status();
    if (status.degradedReason) {
        return status;
    }
    if (!getCortexSettings(db).embedding.apiKeyConfigured) {
        return {
            ...status,
            degradedReason: 'OpenAI API key is not configured.',
        };
    }
    return status;
}

export function findPageRow(db: Database, slugOrId: string): PageRow | null {
    const slug = normalizePageLookup(slugOrId);
    return (
        (db
            .prepare(
                `SELECT *
             FROM cortex_pages
             WHERE deleted_at IS NULL
               AND (id = $input OR slug = $input OR slug = $slug
                    OR id = (SELECT page_id FROM cortex_page_aliases WHERE alias = $input OR alias = $slug LIMIT 1))
             LIMIT 1`
            )
            .get({ $input: slugOrId, $slug: slug }) as PageRow | null) ?? null
    );
}

export function toPage(db: Database, row: PageRow): CortexPage {
    return {
        ...toPageSummary(row),
        body: row.body,
        claims: listClaims(db, row.id),
        compiledTruth: row.compiled_truth,
        createdAt: row.created_at,
        frontmatter: readJsonRecord(row.frontmatter_json),
        indexing: getPageIndexing(db, row.id),
        links: listPageLinks(db, row.id),
        sourceRefs: readJsonArray<CortexSourceRef>(row.source_refs_json),
        timeline: listTimeline(db, row.id),
    };
}

function getPageIndexing(db: Database, pageId: string): CortexPage['indexing'] {
    const embedding = getCortexSettings(db).embedding;
    const row = db
        .prepare(
            `SELECT COUNT(c.id) AS chunkCount,
                    SUM(CASE WHEN e.id IS NOT NULL AND e.input_text_hash = c.text_hash THEN 1 ELSE 0 END) AS currentEmbeddingCount,
                    SUM(CASE WHEN e.id IS NULL THEN 1 ELSE 0 END) AS missingEmbeddingCount,
                    SUM(CASE WHEN e.id IS NOT NULL AND e.input_text_hash != c.text_hash THEN 1 ELSE 0 END) AS staleEmbeddingCount,
                    MAX(e.embedded_at) AS lastEmbeddedAt
             FROM cortex_chunks c
             LEFT JOIN cortex_encodings e
               ON e.chunk_id = c.id
              AND e.provider = $provider
              AND e.model = $model
              AND e.dimensions = $dimensions
             WHERE c.page_id = $pageId`
        )
        .get(
            namedParams({
                dimensions: embedding.dimensions,
                model: embedding.model,
                pageId,
                provider: embedding.provider,
            })
        ) as {
        chunkCount: number;
        currentEmbeddingCount: number | null;
        lastEmbeddedAt: string | null;
        missingEmbeddingCount: number | null;
        staleEmbeddingCount: number | null;
    };
    const chunkCount = row.chunkCount;
    const currentEmbeddingCount = row.currentEmbeddingCount ?? 0;
    const missingEmbeddingCount = row.missingEmbeddingCount ?? 0;
    const staleEmbeddingCount = row.staleEmbeddingCount ?? 0;
    const status =
        chunkCount === 0
            ? 'not-indexed'
            : missingEmbeddingCount === 0 && staleEmbeddingCount === 0
              ? 'ready'
              : 'needs-indexing';

    return {
        chunkCount,
        currentEmbeddingCount,
        embeddingModel: embedding.model,
        embeddingProvider: embedding.provider,
        lastEmbeddedAt: row.lastEmbeddedAt,
        missingEmbeddingCount,
        staleEmbeddingCount,
        status,
    };
}

function listClaims(db: Database, pageId: string): CortexPage['claims'] {
    const rows = db
        .prepare(
            `SELECT id, page_id, subject, predicate, value, confidence, status, source_refs_json
             FROM cortex_claims
             WHERE page_id = ?
             ORDER BY created_at ASC`
        )
        .all(pageId) as ClaimRow[];
    return rows.map((row) => ({
        confidence: row.confidence,
        id: row.id,
        pageId: row.page_id,
        predicate: row.predicate,
        sourceRefs: readJsonArray<CortexSourceRef>(row.source_refs_json),
        status: row.status,
        subject: row.subject,
        value: row.value,
    }));
}

function listTimeline(db: Database, pageId: string): CortexPage['timeline'] {
    const rows = db
        .prepare(
            `SELECT id, body, source_refs_json, created_at
             FROM cortex_timeline_entries
             WHERE page_id = ?
             ORDER BY created_at ASC`
        )
        .all(pageId) as TimelineRow[];
    return rows.map((row) => ({
        body: row.body,
        createdAt: row.created_at,
        id: row.id,
        sourceRefs: readJsonArray<CortexSourceRef>(row.source_refs_json),
    }));
}

function listPageLinks(db: Database, pageId: string) {
    const rows = db
        .prepare(
            `SELECT id, from_page_id, target_slug, target_page_id, heading, label, link_kind, source_location
             FROM cortex_links
             WHERE from_page_id = ?
             ORDER BY created_at ASC`
        )
        .all(pageId) as LinkRow[];
    return rows.map(toLink);
}

function count(db: Database, table: string): number {
    return (db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number }).count;
}

function currentEncodingCount(db: Database, embedding: CortexSettings['embedding']): number {
    return (
        db
            .prepare(
                `SELECT COUNT(*) AS count
             FROM cortex_encodings e
             JOIN cortex_chunks c ON c.id = e.chunk_id
             WHERE e.provider = ?
               AND e.model = ?
               AND e.dimensions = ?
               AND e.input_text_hash = c.text_hash`
            )
            .get(embedding.provider, embedding.model, embedding.dimensions) as { count: number }
    ).count;
}

function staleEncodingCount(db: Database, embedding: CortexSettings['embedding']): number {
    return (
        db
            .prepare(
                `SELECT COUNT(*) AS count
             FROM cortex_encodings e
             JOIN cortex_chunks c ON c.id = e.chunk_id
             WHERE e.provider != ?
                OR e.model != ?
                OR e.dimensions != ?
                OR e.input_text_hash != c.text_hash`
            )
            .get(embedding.provider, embedding.model, embedding.dimensions) as { count: number }
    ).count;
}

function lastAuditAt(db: Database, kind: string): string | null {
    const row = db
        .prepare(
            `SELECT created_at
             FROM cortex_audit_events
             WHERE kind = ?
             ORDER BY created_at DESC
             LIMIT 1`
        )
        .get(kind) as { created_at: string } | null;
    return row?.created_at ?? null;
}

function listRecentJobRuns(db: Database): CortexStatus['jobRuns'] {
    const rows = db
        .prepare(
            `SELECT audit_id, job_name, status, summary, completed_at
             FROM cortex_job_runs
             ORDER BY completed_at DESC
             LIMIT 10`
        )
        .all() as JobRunRow[];
    return rows.map((row) => ({
        auditId: row.audit_id,
        completedAt: row.completed_at,
        job: row.job_name,
        status: row.status,
        summary: row.summary,
    }));
}
