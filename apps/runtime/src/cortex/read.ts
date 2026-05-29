import type {
    CortexBacklinkList,
    CortexPage,
    CortexPageList,
    CortexRecallInput,
    CortexRecallResult,
    CortexRecommendation,
    CortexSearchInput,
    CortexSearchResult,
    CortexSettings,
    CortexSourceRef,
    CortexStatus,
} from '@tavern/api';
import { DATA_DIR, RUNTIME_ROOT } from '../config';
import { hasTable } from '../db/connection';
import type { Database } from '../db/sqlite';
import { namedParams } from '../db/sqlite';
import { writeCortexAudit } from './audit';
import { embedCortexText } from './encoding';
import { type CortexIssue, type CortexIssueKind, detectCortexIssues } from './lint';
import {
    type ChunkEncodingRow,
    type ClaimRow,
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
    const recall = await runRecallSearch(db, input, mode, vectorDatabase);
    const auditId = writeCortexAudit(db, {
        kind: 'recall',
        metadata: {
            effectiveMode: mode,
            expandedQueries: recall.expandedQueries,
            expandedQueryCount: recall.expandedQueries.length,
            payload: estimateRecallPayload(recall.result),
            requestedMode: input.mode ?? null,
            resultCount: recall.result.hits.length,
            vectorDegradedReason: recall.result.vectorDegradedReason,
        },
        recordRefs: recall.result.hits.map((hit) => hit.page.id),
        sourceRefs: [],
        status: 'success',
        summary: `Recalled ${recall.result.hits.length} Cortex page(s).`,
    });
    return {
        auditId,
        hits: recall.result.hits.map((hit) => ({
            ...hit,
            evidence: getCortexPage(db, hit.page.id)?.sourceRefs ?? [],
        })),
        mode,
        query: recall.result.query,
        requestedMode: input.mode ?? null,
        vectorDegradedReason: recall.result.vectorDegradedReason,
    };
}

function estimateRecallPayload(result: CortexSearchResult) {
    const chars = result.hits.reduce(
        (total, hit) =>
            total +
            hit.snippet.length +
            hit.page.title.length +
            hit.page.slug.length +
            hit.page.tags.join(' ').length,
        0
    );
    return {
        estimatedTokens: Math.ceil(chars / 4),
        returnedChars: chars,
        returnedPageIds: result.hits.map((hit) => hit.page.id),
    };
}

async function runRecallSearch(
    db: Database,
    input: CortexRecallInput,
    mode: CortexRecallResult['mode'],
    vectorDatabase: CortexVectorDatabase
): Promise<{ expandedQueries: string[]; result: CortexSearchResult }> {
    if (mode !== 'tokenmax') {
        return {
            expandedQueries: [],
            result: await searchCortex(db, resolveRecallSearchInput(input, mode), vectorDatabase),
        };
    }

    return searchCortexTokenmax(db, resolveRecallSearchInput(input, mode), vectorDatabase);
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

async function searchCortexTokenmax(
    db: Database,
    input: CortexSearchInput,
    vectorDatabase: CortexVectorDatabase
): Promise<{ expandedQueries: string[]; result: CortexSearchResult }> {
    const limit = input.limit ?? recallModeLimits.tokenmax;
    const primary = await searchCortex(db, { ...input, limit: 50 }, vectorDatabase);
    const expandedQueries = buildTokenmaxExpandedQueries(db, input.query, primary.hits);
    const merged = new Map<string, CortexSearchResult['hits'][number]>();
    let vectorDegradedReason = primary.vectorDegradedReason;

    mergeSearchHits(merged, primary.hits, 1);
    for (const query of expandedQueries) {
        const expanded = await searchCortex(db, { ...input, limit: 50, query }, vectorDatabase);
        vectorDegradedReason ??= expanded.vectorDegradedReason;
        mergeSearchHits(merged, expanded.hits, 0.8);
    }

    addTokenmaxGraphHits(db, merged, input, primary.hits);

    const hits = Array.from(merged.values())
        .sort((left, right) => right.score - left.score)
        .slice(0, limit);

    return {
        expandedQueries,
        result: {
            hits,
            query: input.query,
            vectorDegradedReason,
        },
    };
}

function mergeSearchHits(
    merged: Map<string, CortexSearchResult['hits'][number]>,
    hits: CortexSearchResult['hits'],
    weight: number
): void {
    for (const hit of hits) {
        const score = hit.score * weight;
        const existing = merged.get(hit.page.id);
        merged.set(
            hit.page.id,
            existing ? { ...existing, score: Math.max(existing.score, score) } : { ...hit, score }
        );
    }
}

function buildTokenmaxExpandedQueries(
    db: Database,
    query: string,
    hits: CortexSearchResult['hits']
): string[] {
    const terms = new Set(tokenize(query));
    const expansions: string[] = [];
    for (const hit of hits.slice(0, 5)) {
        const page = getCortexPage(db, hit.page.id);
        if (!page) {
            continue;
        }
        const pageTerms = [
            page.title,
            page.slug,
            page.type,
            ...page.tags,
            ...page.aliases,
            ...page.links.flatMap((link) => [link.targetSlug, link.label ?? '', link.linkKind]),
        ]
            .flatMap(tokenize)
            .filter((term) => !terms.has(term));
        const uniqueTerms = [...new Set(pageTerms)].slice(0, 12);
        if (uniqueTerms.length > 0) {
            expansions.push(`${query} ${uniqueTerms.join(' ')}`);
            for (const term of uniqueTerms) {
                terms.add(term);
            }
        }
        if (expansions.length >= 3) {
            break;
        }
    }
    return expansions;
}

function addTokenmaxGraphHits(
    db: Database,
    merged: Map<string, CortexSearchResult['hits'][number]>,
    input: CortexSearchInput,
    seedHits: CortexSearchResult['hits']
): void {
    const seedIds = seedHits.slice(0, 12).map((hit) => hit.page.id);
    if (seedIds.length === 0) {
        return;
    }
    const seedScores = new Map(seedHits.map((hit) => [hit.page.id, hit.score]));
    const rows = db
        .prepare(
            `SELECT from_page_id, target_page_id, target_slug, link_kind
             FROM cortex_links
             WHERE from_page_id IN (${seedIds.map(() => '?').join(',')})
                OR target_page_id IN (${seedIds.map(() => '?').join(',')})`
        )
        .all(...seedIds, ...seedIds) as Array<{
        from_page_id: string;
        link_kind: string;
        target_page_id: string | null;
        target_slug: string;
    }>;

    const queryTerms = tokenize(input.query);
    for (const row of rows) {
        const candidates = [
            { anchorId: row.from_page_id, pageId: row.target_page_id, slug: row.target_slug },
            { anchorId: row.target_page_id, pageId: row.from_page_id, slug: null },
        ];
        for (const candidate of candidates) {
            if (!(candidate.anchorId && seedScores.has(candidate.anchorId))) {
                continue;
            }
            const page = candidate.pageId
                ? findPageRow(db, candidate.pageId)
                : candidate.slug
                  ? findPageRow(db, candidate.slug)
                  : null;
            if (!isGraphRecallCandidate(page, input.scope)) {
                continue;
            }
            const existing = merged.get(page.id);
            const anchorScore = seedScores.get(candidate.anchorId) ?? 0;
            const graphScore = anchorScore * graphWeight(row.link_kind);
            const hit = {
                page: toPageSummary(page),
                score: existing ? Math.max(existing.score, graphScore) : graphScore,
                snippet: existing?.snippet ?? snippet(page, queryTerms),
            };
            merged.set(page.id, hit);
        }
    }
}

function isGraphRecallCandidate(
    page: PageRow | null,
    scope: CortexSearchInput['scope']
): page is PageRow {
    return Boolean(
        page &&
            page.status !== 'archived' &&
            page.status !== 'deleted' &&
            matchesScope(page.frontmatter_json, scope)
    );
}

function graphWeight(linkKind: string): number {
    switch (linkKind) {
        case 'same_as':
        case 'supports':
        case 'contradicts':
            return 0.75;
        case 'depends_on':
        case 'blocks':
        case 'uses':
        case 'tracks':
            return 0.55;
        default:
            return 0.35;
    }
}

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
    const issues = detectCortexIssues(db);
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
        recommendations: buildCortexRecommendations(
            issues,
            cortexSettings.embedding.apiKeyConfigured
        ),
        sourceCount: count(db, 'cortex_sources'),
        timelineEntryCount: count(db, 'cortex_timeline_entries'),
        vectorIndex: await withEmbeddingDegradedReason(db, vectorDatabase),
        wikiPath: resolveCortexWikiPath(),
    };
}

function buildCortexRecommendations(
    issues: CortexIssue[],
    embeddingConfigured: boolean
): CortexRecommendation[] {
    const recommendations: CortexRecommendation[] = [];
    const add = (kind: CortexIssueKind, input: Omit<CortexRecommendation, 'count' | 'kind'>) => {
        const count = issues.filter((issue) => issue.kind === kind).length;
        if (count > 0) {
            recommendations.push({ ...input, count, kind });
        }
    };

    add('unresolved-link', {
        action: 'run-cortex-maintenance',
        severity: 'warning',
        summary: 'Some Cortex links do not resolve to pages.',
    });
    add('invalid-link-kind', {
        action: 'inspect-lint',
        severity: 'error',
        summary: 'Some Cortex links use relationship types outside the active schema.',
    });
    add('unsourced-page', {
        action: 'inspect-lint',
        severity: 'warning',
        summary: 'Some Cortex pages do not have source references.',
    });
    add('missing-citation', {
        action: 'inspect-lint',
        severity: 'info',
        summary: 'Some sourced Cortex pages do not have citation rows.',
    });
    add('without-timeline', {
        action: 'run-cortex-sync',
        severity: 'warning',
        summary: 'Some Cortex pages do not have timeline evidence.',
    });
    add('orphan-page', {
        action: 'inspect-lint',
        severity: 'info',
        summary: 'Some Cortex pages are not connected to the graph.',
    });
    add('missing-chunks', {
        action: 'run-cortex-maintenance',
        severity: 'warning',
        summary: 'Some Cortex pages are missing derived chunks.',
    });
    add('stale-embedding', {
        action: embeddingConfigured ? 'run-cortex-generate-embeddings' : 'configure-embeddings',
        severity: 'warning',
        summary: 'Some Cortex embeddings are stale.',
    });
    add('failed-capture', {
        action: 'inspect-lint',
        severity: 'error',
        summary: 'Some Cortex captures failed.',
    });
    add('failed-dream', {
        action: 'inspect-lint',
        severity: 'error',
        summary: 'Some Cortex Dream reviews failed.',
    });
    add('failed-signal', {
        action: 'inspect-lint',
        severity: 'error',
        summary: 'Some Cortex Signal reviews failed.',
    });

    if (!embeddingConfigured) {
        recommendations.push({
            action: 'configure-embeddings',
            count: 1,
            kind: 'embedding-not-configured',
            severity: 'info',
            summary: 'Configure embeddings to enable semantic Cortex recall.',
        });
    }

    return recommendations;
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
            `SELECT id, page_id, subject, predicate, value, confidence, status, source_refs_json, supersedes_claim_id
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
        supersedesClaimId: row.supersedes_claim_id,
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
    if (!hasTable(db, 'runtime_job_runs')) {
        return [];
    }
    const rows = db
        .prepare(
            `SELECT job_slug, state, error, logs_json, created_at, finished_at, updated_at
             FROM runtime_job_runs
             WHERE job_slug IN (
               'cortex-sync',
               'cortex-generate-embeddings',
               'cortex-lint',
               'cortex-maintenance',
               'cortex-signal',
               'cortex-dream'
             )
             ORDER BY created_at DESC
             LIMIT 10`
        )
        .all() as Array<{
        created_at: string;
        error: string | null;
        finished_at: string | null;
        job_slug: string;
        logs_json: string;
        state: string;
        updated_at: string;
    }>;
    return rows.map((row) => ({
        auditId: `runtime:${row.job_slug}:${row.created_at}`,
        completedAt: row.finished_at ?? row.updated_at ?? row.created_at,
        job: toCortexJobName(row.job_slug),
        status:
            row.state === 'failed' ? 'error' : row.state === 'completed' ? 'success' : 'skipped',
        summary: row.error ?? latestLog(row.logs_json) ?? `${row.job_slug} ${row.state}`,
    }));
}

function toCortexJobName(jobSlug: string): CortexStatus['jobRuns'][number]['job'] {
    switch (jobSlug) {
        case 'cortex-sync':
            return 'sync';
        case 'cortex-generate-embeddings':
            return 'generate-embeddings';
        case 'cortex-lint':
            return 'lint';
        case 'cortex-maintenance':
            return 'maintenance';
        case 'cortex-signal':
            return 'signal';
        case 'cortex-dream':
            return 'dream';
        default:
            return 'lint';
    }
}

function latestLog(logsJson: string): string | null {
    try {
        const logs = JSON.parse(logsJson) as unknown;
        return Array.isArray(logs) && typeof logs.at(-1) === 'string' ? logs.at(-1) : null;
    } catch {
        return null;
    }
}
