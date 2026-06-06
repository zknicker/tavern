import type {
    CortexBacklinkList,
    CortexGraphDirection,
    CortexGraphTraversal,
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
import { RUNTIME_ROOT } from '../config';
import { writeCortexAudit } from './audit';
import type { CortexDatabase } from './db';
import { resolveCortexDatabasePath } from './db';
import { embedCortexText } from './encoding';
import { type CortexIssue, type CortexIssueKind, detectCortexIssues } from './lint';
import { expandCortexRecallQuery } from './query-expansion';
import {
    type ClaimRow,
    type LinkRow,
    normalizePageLookup,
    type PageRow,
    readJsonArray,
    readJsonRecord,
    readStringArray,
    scoreLexical,
    snippet,
    type TimelineRow,
    tokenize,
    toLink,
    toPageSummary,
} from './rows';
import { getCortexSettings } from './settings';

export const cortexWikiPath = `${RUNTIME_ROOT}/cortex/wiki`;

export function resolveCortexWikiPath() {
    return process.env.TAVERN_CORTEX_WIKI_PATH?.trim() || cortexWikiPath;
}

export async function listCortexPages(db: CortexDatabase, limit = 100): Promise<CortexPageList> {
    const rows = await db
        .prepare(
            `SELECT id, slug, title, type, status, frontmatter_json, updated_at
             FROM cortex_pages
             WHERE deleted_at IS NULL
             ORDER BY updated_at DESC
             LIMIT ?`
        )
        .all<PageRow>(limit);
    return {
        pages: await Promise.all(
            rows.map(async (row) => ({
                ...toPageSummary(row),
                links: await listPageLinks(db, row.id),
            }))
        ),
    };
}

export async function getCortexPage(
    db: CortexDatabase,
    slugOrId: string
): Promise<CortexPage | null> {
    const row = await findPageRow(db, slugOrId);
    return row ? await toPage(db, row) : null;
}

export async function searchCortex(
    db: CortexDatabase,
    input: CortexSearchInput
): Promise<CortexSearchResult> {
    const limit = input.limit ?? 10;
    const offset = input.offset ?? 0;
    const explain = input.explain ?? false;
    const queryTerms = tokenize(input.query);
    const normalizedQuery = normalizePageLookup(input.query);
    const rows = await db
        .prepare(
            `SELECT p.id AS page_id,
                    p.frontmatter_json,
                    p.slug,
                    p.title,
                    p.title || ' ' || p.slug || ' ' || p.compiled_truth || ' ' || p.body AS score_text
             FROM cortex_pages p
             WHERE p.deleted_at IS NULL
               AND p.status IN ('active', 'stale')`
        )
        .all<SearchRow>();
    const scores = new Map<string, SearchScore>();
    let vectorDegradedReason: string | null = null;

    for (const row of rows) {
        if (!matchesScope(row.frontmatter_json, input.scope)) {
            continue;
        }
        const frontmatter = readJsonRecord(row.frontmatter_json);
        const aliases = readStringArray(frontmatter.aliases);
        const matchedAliases = aliases.filter((alias) => slugifyAlias(alias) === normalizedQuery);
        const lexical = scoreLexical(row.score_text, queryTerms);
        const titleMatched = titleMatches(`${row.title} ${row.slug}`, input.query);
        const aliasScore = matchedAliases.length > 0 ? queryTerms.length || 1 : 0;
        const lexicalScore = Math.max(lexical, aliasScore);
        scores.set(row.page_id, {
            finalScore: lexicalScore,
            lexicalScore,
            matchedAliases,
            titleMatched,
            vectorScore: null,
        });
    }

    try {
        const queryEmbedding = await embedCortexText(db, input.query);
        if (queryEmbedding) {
            const vectorHits = await searchCortexVectors(db, {
                dimensions: queryEmbedding.dimensions,
                limit: Math.max((offset + limit) * 4, limit),
                model: queryEmbedding.model,
                provider: queryEmbedding.provider,
                vector: queryEmbedding.vector,
            });

            for (const hit of vectorHits) {
                const page = await findPageRow(db, hit.pageId);
                if (!(page && matchesScope(page.frontmatter_json, input.scope))) {
                    continue;
                }
                const existing = scores.get(hit.pageId);
                scores.set(hit.pageId, {
                    finalScore: Math.max(existing?.finalScore ?? 0, hit.score),
                    lexicalScore: existing?.lexicalScore ?? 0,
                    matchedAliases: existing?.matchedAliases ?? [],
                    titleMatched: existing?.titleMatched ?? false,
                    vectorScore: Math.max(existing?.vectorScore ?? 0, hit.score),
                });
            }
        }
    } catch (error) {
        vectorDegradedReason = error instanceof Error ? error.message : 'Vector search failed.';
        // Lexical search remains available when the derived vector index is degraded.
    }

    const scoredPages = Array.from(scores.entries())
        .filter(([, score]) => score.finalScore > 0)
        .sort((left, right) => right[1].finalScore - left[1].finalScore);
    const pagedPages = scoredPages.slice(offset, offset + limit);
    const hits: CortexSearchResult['hits'] = [];
    for (const [index, [pageId, score]] of pagedPages.entries()) {
        const page = await findPageRow(db, pageId);
        if (page) {
            hits.push({
                diagnostics: explain
                    ? buildSearchDiagnostics({
                          normalizedQuery,
                          page,
                          queryTerms,
                          rank: offset + index + 1,
                          score,
                      })
                    : undefined,
                page: toPageSummary(page),
                score: score.finalScore,
                snippet: snippet(page, queryTerms),
            });
        }
    }

    return {
        diagnostics: explain
            ? {
                  explain: true,
                  limit,
                  offset,
                  returnedCount: hits.length,
                  totalHitCount: scoredPages.length,
              }
            : undefined,
        hits,
        limit,
        offset,
        query: input.query,
        vectorDegradedReason,
    };
}

interface SearchRow {
    frontmatter_json: string;
    page_id: string;
    score_text: string;
    slug: string;
    title: string;
}

interface SearchScore {
    finalScore: number;
    lexicalScore: number;
    matchedAliases: string[];
    titleMatched: boolean;
    vectorScore: number | null;
}

function buildSearchDiagnostics(input: {
    normalizedQuery: string;
    page: PageRow;
    queryTerms: string[];
    rank: number;
    score: SearchScore;
}): NonNullable<CortexSearchResult['hits'][number]['diagnostics']> {
    const evidence: NonNullable<CortexSearchResult['hits'][number]['diagnostics']>['evidence'] = [];
    if (input.score.lexicalScore > 0) {
        evidence.push('lexical');
    }
    if (input.score.vectorScore !== null && input.score.vectorScore > 0) {
        evidence.push('vector');
    }
    if (input.score.titleMatched) {
        evidence.push('title');
    }
    if (input.score.matchedAliases.length > 0) {
        evidence.push('alias');
    }
    return {
        createSafety: resolveCreateSafety(input),
        evidence,
        finalScore: input.score.finalScore,
        lexicalScore: input.score.lexicalScore,
        matchedAliases: input.score.matchedAliases,
        rank: input.rank,
        vectorScore: input.score.vectorScore,
    };
}

function resolveCreateSafety(input: {
    normalizedQuery: string;
    page: PageRow;
    queryTerms: string[];
    score: SearchScore;
}): NonNullable<CortexSearchResult['hits'][number]['diagnostics']>['createSafety'] {
    if (
        input.page.slug === input.normalizedQuery ||
        input.score.matchedAliases.length > 0 ||
        input.score.titleMatched
    ) {
        return 'exists';
    }
    return input.queryTerms.length > 0 && input.score.lexicalScore >= input.queryTerms.length
        ? 'probable'
        : 'unknown';
}

function titleMatches(text: string, query: string): boolean {
    const normalizedText = text.toLowerCase();
    const normalizedQuery = query.trim().toLowerCase();
    return normalizedQuery.length > 0 && normalizedText.includes(normalizedQuery);
}

function slugifyAlias(value: string): string {
    return normalizePageLookup(value);
}

interface VectorHit {
    chunkId: string;
    pageId: string;
    score: number;
    textHash: string;
}

type CortexSearchScope = NonNullable<CortexSearchInput['scope']>;

async function searchCortexVectors(
    db: CortexDatabase,
    input: {
        dimensions: number;
        limit: number;
        model: string;
        provider: string;
        vector: number[];
    }
): Promise<VectorHit[]> {
    const rows = await db
        .prepare(
            `SELECT c.id AS chunkId,
                    c.page_id AS pageId,
                    c.text_hash AS textHash,
                    1 - (e.embedding <=> $vector) AS score
             FROM cortex_encodings e
             JOIN cortex_chunks c ON c.id = e.chunk_id
             WHERE e.provider = $provider
               AND e.model = $model
               AND e.dimensions = $dimensions
               AND e.input_text_hash = c.text_hash
               AND e.embedding IS NOT NULL
             ORDER BY e.embedding <=> $vector ASC
             LIMIT $limit`
        )
        .all<{
            chunkid?: string;
            chunkId?: string;
            pageid?: string;
            pageId?: string;
            score: number;
            texthash?: string;
            textHash?: string;
        }>({
            dimensions: input.dimensions,
            limit: input.limit,
            model: input.model,
            provider: input.provider,
            vector: vectorLiteral(input.vector),
        });
    return rows.flatMap((row) => {
        const chunkId = row.chunkId ?? row.chunkid;
        const pageId = row.pageId ?? row.pageid;
        const textHash = row.textHash ?? row.texthash;
        return chunkId && pageId && textHash
            ? [{ chunkId, pageId, score: row.score, textHash }]
            : [];
    });
}

function vectorLiteral(vector: number[]): string {
    return `[${vector.join(',')}]`;
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
    db: CortexDatabase,
    input: CortexRecallInput
): Promise<CortexRecallResult> {
    const mode = input.mode ?? (await getCortexSettings(db)).recall.mode;
    const recall = await runRecallSearch(db, input, mode);
    const auditId = await writeCortexAudit(db, {
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
        hits: await Promise.all(
            recall.result.hits.map(async (hit) => ({
                ...hit,
                evidence: (await getCortexPage(db, hit.page.id))?.sourceRefs ?? [],
            }))
        ),
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
    db: CortexDatabase,
    input: CortexRecallInput,
    mode: CortexRecallResult['mode']
): Promise<{ expandedQueries: string[]; result: CortexSearchResult }> {
    if (mode !== 'tokenmax') {
        return {
            expandedQueries: [],
            result: await searchCortex(db, resolveRecallSearchInput(input, mode)),
        };
    }

    return searchCortexTokenmax(db, resolveRecallSearchInput(input, mode));
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
    db: CortexDatabase,
    input: CortexSearchInput
): Promise<{ expandedQueries: string[]; result: CortexSearchResult }> {
    const limit = input.limit ?? recallModeLimits.tokenmax;
    const primary = await searchCortex(db, { ...input, limit: 50 });
    const expandedQueries = await buildTokenmaxExpandedQueries(db, input.query, primary.hits);
    const merged = new Map<string, CortexSearchResult['hits'][number]>();
    let vectorDegradedReason = primary.vectorDegradedReason;

    mergeSearchHits(merged, primary.hits, 1);
    for (const query of expandedQueries) {
        const expanded = await searchCortex(db, { ...input, limit: 50, query });
        vectorDegradedReason ??= expanded.vectorDegradedReason;
        mergeSearchHits(merged, expanded.hits, 0.8);
    }

    await addTokenmaxGraphHits(db, merged, input, primary.hits);

    const hits = Array.from(merged.values())
        .sort((left, right) => right.score - left.score)
        .slice(0, limit);

    return {
        expandedQueries,
        result: {
            hits,
            limit,
            offset: input.offset ?? 0,
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

async function buildTokenmaxExpandedQueries(
    db: CortexDatabase,
    query: string,
    hits: CortexSearchResult['hits']
): Promise<string[]> {
    const settings = await getCortexSettings(db);
    const modelQueries = await expandCortexRecallQuery({
        hits,
        modelRef: settings.models.queryExpansion,
        query,
    }).catch(() => []);
    const terms = new Set(tokenize(query));
    const expansions: string[] = [...modelQueries];
    for (const modelQuery of modelQueries) {
        for (const term of tokenize(modelQuery)) {
            terms.add(term);
        }
    }
    if (expansions.length >= 3) {
        return expansions.slice(0, 3);
    }
    for (const hit of hits.slice(0, 5)) {
        const page = await getCortexPage(db, hit.page.id);
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
    return expansions.slice(0, 3);
}

async function addTokenmaxGraphHits(
    db: CortexDatabase,
    merged: Map<string, CortexSearchResult['hits'][number]>,
    input: CortexSearchInput,
    seedHits: CortexSearchResult['hits']
): Promise<void> {
    const seedIds = seedHits.slice(0, 12).map((hit) => hit.page.id);
    if (seedIds.length === 0) {
        return;
    }
    const seedScores = new Map(seedHits.map((hit) => [hit.page.id, hit.score]));
    const rows = await db
        .prepare(
            `SELECT from_page_id, target_page_id, target_slug, link_kind
             FROM cortex_links
             WHERE from_page_id IN (${seedIds.map(() => '?').join(',')})
                OR target_page_id IN (${seedIds.map(() => '?').join(',')})`
        )
        .all<{
            from_page_id: string;
            link_kind: string;
            target_page_id: string | null;
            target_slug: string;
        }>(...seedIds, ...seedIds);

    const queryTerms = tokenize(input.query);
    for (const row of rows) {
        const candidates = [
            {
                anchorId: row.from_page_id,
                pageId: row.target_page_id,
                slug: row.target_slug,
            },
            { anchorId: row.target_page_id, pageId: row.from_page_id, slug: null },
        ];
        for (const candidate of candidates) {
            if (!(candidate.anchorId && seedScores.has(candidate.anchorId))) {
                continue;
            }
            const page = candidate.pageId
                ? await findPageRow(db, candidate.pageId)
                : candidate.slug
                  ? await findPageRow(db, candidate.slug)
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

export async function listCortexBacklinks(
    db: CortexDatabase,
    target: string
): Promise<CortexBacklinkList> {
    const links = await db
        .prepare(
            `SELECT id, from_page_id, target_slug, target_page_id, heading, label, link_kind, source_location
             FROM cortex_links
             WHERE target_slug = ? OR target_page_id = ?
             ORDER BY created_at DESC`
        )
        .all<LinkRow>(normalizePageLookup(target), target);
    return { links: links.map(toLink), target };
}

export async function traverseCortexGraph(
    db: CortexDatabase,
    input: {
        depth?: number;
        direction?: CortexGraphDirection;
        root: string;
        type?: string | null;
    }
): Promise<CortexGraphTraversal> {
    const depth = Math.max(1, Math.min(10, input.depth ?? 5));
    const direction = input.direction ?? 'out';
    const root = normalizeGraphRoot(input.root);
    const type = input.type?.trim() || null;
    const paths =
        direction === 'out'
            ? await traverseOutboundGraph(db, root, depth, type)
            : direction === 'in'
              ? await traverseInboundGraph(db, root, depth, type)
              : await traverseBidirectionalGraph(db, root, depth, type);

    return {
        depth,
        direction,
        paths: dedupeGraphPaths(paths),
        root,
        type,
    };
}

function normalizeGraphRoot(root: string): string {
    const trimmed = root.trim();
    return trimmed.startsWith('ctxp_') ? trimmed : normalizePageLookup(trimmed);
}

export async function getCortexStatus(db: CortexDatabase): Promise<CortexStatus> {
    const cortexSettings = await getCortexSettings(db);
    const issues = await detectCortexIssues(db);
    return {
        auditCount: await count(db, 'cortex_audit_events'),
        captureCount: await count(db, 'cortex_captures'),
        chunkCount: await count(db, 'cortex_chunks'),
        claimCount: await count(db, 'cortex_claims'),
        databasePath: resolveCortexDatabasePath(),
        encoding: {
            currentCount: await currentEncodingCount(db, cortexSettings.embedding),
            dimensions: cortexSettings.embedding.dimensions,
            model: cortexSettings.embedding.model,
            provider: cortexSettings.embedding.provider,
            staleCount: await staleEncodingCount(db, cortexSettings.embedding),
            totalCount: await count(db, 'cortex_encodings'),
        },
        jobRuns: await listRecentJobRuns(db),
        lastCaptureAt: await lastAuditAt(db, 'capture'),
        lastRecallAt: await lastAuditAt(db, 'recall'),
        lastRepairAt: await lastAuditAt(db, 'job.repair-derived-state'),
        linkCount: await count(db, 'cortex_links'),
        pageCount: await count(db, 'cortex_pages'),
        recommendations: buildCortexRecommendations(
            issues,
            cortexSettings.embedding.apiKeyConfigured
        ),
        sourceCount: await count(db, 'cortex_sources'),
        timelineEntryCount: await count(db, 'cortex_timeline_entries'),
        vectorIndex: await getVectorIndexStatus(db, cortexSettings),
        wikiPath: resolveCortexWikiPath(),
    };
}

type GraphPathRow = CortexGraphTraversal['paths'][number];

async function traverseOutboundGraph(
    db: CortexDatabase,
    root: string,
    depth: number,
    type: string | null
): Promise<GraphPathRow[]> {
    const rows = await db.query<{
        context: string | null;
        depth: number;
        fromslug: string;
        fromSlug: string;
        linkkind: string;
        linkKind: string;
        toslug: string;
        toSlug: string;
    }>(
        `WITH RECURSIVE walk AS (
           SELECT p.id, p.slug, 0::int AS depth, ARRAY[p.id] AS visited
           FROM cortex_pages p
           WHERE p.deleted_at IS NULL
             AND (p.slug = $1 OR p.id = $1)
           UNION ALL
           SELECT target.id, target.slug, w.depth + 1, w.visited || target.id
           FROM walk w
           JOIN cortex_links l ON l.from_page_id = w.id
           JOIN cortex_pages target
             ON target.deleted_at IS NULL
            AND (target.id = l.target_page_id OR target.slug = l.target_slug)
           WHERE w.depth < $2
             AND NOT (target.id = ANY(w.visited))
             AND ($3::text IS NULL OR l.link_kind = $3)
         )
         SELECT w.slug AS "fromSlug",
                target.slug AS "toSlug",
                l.link_kind AS "linkKind",
                COALESCE(l.label, l.heading, l.source_location, '') AS context,
                w.depth + 1 AS depth
         FROM walk w
         JOIN cortex_links l ON l.from_page_id = w.id
         JOIN cortex_pages target
           ON target.deleted_at IS NULL
          AND (target.id = l.target_page_id OR target.slug = l.target_slug)
         WHERE w.depth < $2
           AND ($3::text IS NULL OR l.link_kind = $3)
         ORDER BY depth, "fromSlug", "toSlug"`,
        [root, depth, type]
    );
    return rows.map(toGraphPath);
}

async function traverseInboundGraph(
    db: CortexDatabase,
    root: string,
    depth: number,
    type: string | null
): Promise<GraphPathRow[]> {
    const rows = await db.query<{
        context: string | null;
        depth: number;
        fromslug: string;
        fromSlug: string;
        linkkind: string;
        linkKind: string;
        toslug: string;
        toSlug: string;
    }>(
        `WITH RECURSIVE walk AS (
           SELECT p.id, p.slug, 0::int AS depth, ARRAY[p.id] AS visited
           FROM cortex_pages p
           WHERE p.deleted_at IS NULL
             AND (p.slug = $1 OR p.id = $1)
           UNION ALL
           SELECT source.id, source.slug, w.depth + 1, w.visited || source.id
           FROM walk w
           JOIN cortex_links l
             ON l.target_page_id = w.id OR l.target_slug = w.slug
           JOIN cortex_pages source
             ON source.deleted_at IS NULL
            AND source.id = l.from_page_id
           WHERE w.depth < $2
             AND NOT (source.id = ANY(w.visited))
             AND ($3::text IS NULL OR l.link_kind = $3)
         )
         SELECT source.slug AS "fromSlug",
                w.slug AS "toSlug",
                l.link_kind AS "linkKind",
                COALESCE(l.label, l.heading, l.source_location, '') AS context,
                w.depth + 1 AS depth
         FROM walk w
         JOIN cortex_links l
           ON l.target_page_id = w.id OR l.target_slug = w.slug
         JOIN cortex_pages source
           ON source.deleted_at IS NULL
          AND source.id = l.from_page_id
         WHERE w.depth < $2
           AND ($3::text IS NULL OR l.link_kind = $3)
         ORDER BY depth, "fromSlug", "toSlug"`,
        [root, depth, type]
    );
    return rows.map(toGraphPath);
}

async function traverseBidirectionalGraph(
    db: CortexDatabase,
    root: string,
    depth: number,
    type: string | null
): Promise<GraphPathRow[]> {
    const rows = await db.query<{
        context: string | null;
        depth: number;
        fromslug: string;
        fromSlug: string;
        linkkind: string;
        linkKind: string;
        toslug: string;
        toSlug: string;
    }>(
        `WITH RECURSIVE walk AS (
           SELECT p.id, p.slug, 0::int AS depth, ARRAY[p.id] AS visited
           FROM cortex_pages p
           WHERE p.deleted_at IS NULL
             AND (p.slug = $1 OR p.id = $1)
           UNION ALL
           SELECT neighbor.id, neighbor.slug, w.depth + 1, w.visited || neighbor.id
           FROM walk w
           JOIN cortex_links l
             ON l.from_page_id = w.id OR l.target_page_id = w.id OR l.target_slug = w.slug
           JOIN cortex_pages neighbor
             ON neighbor.deleted_at IS NULL
            AND neighbor.id = CASE
                  WHEN l.from_page_id = w.id THEN COALESCE(l.target_page_id, neighbor.id)
                  ELSE l.from_page_id
                END
            AND (
                  (l.from_page_id = w.id AND (neighbor.id = l.target_page_id OR neighbor.slug = l.target_slug))
                  OR ((l.target_page_id = w.id OR l.target_slug = w.slug) AND neighbor.id = l.from_page_id)
                )
           WHERE w.depth < $2
             AND NOT (neighbor.id = ANY(w.visited))
             AND ($3::text IS NULL OR l.link_kind = $3)
         )
         SELECT source.slug AS "fromSlug",
                target.slug AS "toSlug",
                l.link_kind AS "linkKind",
                COALESCE(l.label, l.heading, l.source_location, '') AS context,
                w.depth + 1 AS depth
         FROM walk w
         JOIN cortex_links l
           ON l.from_page_id = w.id OR l.target_page_id = w.id OR l.target_slug = w.slug
         JOIN cortex_pages source
           ON source.deleted_at IS NULL
          AND source.id = l.from_page_id
         JOIN cortex_pages target
           ON target.deleted_at IS NULL
          AND (target.id = l.target_page_id OR target.slug = l.target_slug)
         WHERE w.depth < $2
           AND ($3::text IS NULL OR l.link_kind = $3)
         ORDER BY depth, "fromSlug", "toSlug"`,
        [root, depth, type]
    );
    return rows.map(toGraphPath);
}

function toGraphPath(row: {
    context: string | null;
    depth: number;
    fromslug: string;
    fromSlug: string;
    linkkind: string;
    linkKind: string;
    toslug: string;
    toSlug: string;
}): GraphPathRow {
    return {
        context: row.context ?? '',
        depth: Number(row.depth),
        fromSlug: row.fromSlug ?? row.fromslug,
        linkKind: row.linkKind ?? row.linkkind,
        toSlug: row.toSlug ?? row.toslug,
    };
}

function dedupeGraphPaths(paths: GraphPathRow[]): GraphPathRow[] {
    const seen = new Set<string>();
    const deduped: GraphPathRow[] = [];
    for (const path of paths) {
        const key = `${path.fromSlug}|${path.toSlug}|${path.linkKind}|${path.depth}`;
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        deduped.push(path);
    }
    return deduped;
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
        action: 'run-cortex-repair-derived-state',
        severity: 'warning',
        summary: 'Some Cortex links do not resolve to pages.',
    });
    add('invalid-link-kind', {
        action: 'inspect-lint',
        severity: 'error',
        summary: 'Some Cortex links use relationship types outside the active schema.',
    });
    add('invalid-page-type', {
        action: 'inspect-lint',
        severity: 'error',
        summary: 'Some Cortex pages use page types outside the active schema.',
    });
    add('duplicate-page', {
        action: 'inspect-lint',
        severity: 'warning',
        summary: 'Some Cortex pages may duplicate another page.',
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
    add('broken-citation', {
        action: 'inspect-lint',
        severity: 'error',
        summary: 'Some Cortex citations point at missing records.',
    });
    add('without-timeline', {
        action: 'run-cortex-sync',
        severity: 'warning',
        summary: 'Some Cortex pages do not have timeline evidence.',
    });
    add('stale-page', {
        action: 'inspect-lint',
        severity: 'warning',
        summary: 'Some Cortex pages need compiled truth refreshed from newer evidence.',
    });
    add('orphan-page', {
        action: 'inspect-lint',
        severity: 'info',
        summary: 'Some Cortex pages are not connected to the graph.',
    });
    add('missing-cross-reference', {
        action: 'inspect-lint',
        severity: 'warning',
        summary: 'Some Cortex pages mention known pages without graph links.',
    });
    add('missing-chunks', {
        action: 'run-cortex-repair-derived-state',
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
    add('failed-chat-ingestion', {
        action: 'inspect-lint',
        severity: 'error',
        summary: 'Some Cortex Chat Ingestion reviews failed.',
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

async function getVectorIndexStatus(
    db: CortexDatabase,
    settings: CortexSettings
): Promise<CortexStatus['vectorIndex']> {
    return {
        backend: 'pglite-vector',
        degradedReason: settings.embedding.apiKeyConfigured
            ? null
            : 'OpenAI API key is not configured.',
        indexedCount: await currentEncodingCount(db, settings.embedding),
        path: resolveCortexDatabasePath(),
        table: 'cortex_encodings',
    };
}

export async function findPageRow(db: CortexDatabase, slugOrId: string): Promise<PageRow | null> {
    const slug = normalizePageLookup(slugOrId);
    return (
        (await db
            .prepare(
                `SELECT *
             FROM cortex_pages
             WHERE deleted_at IS NULL
               AND (id = $input OR slug = $input OR slug = $slug
                    OR id = (SELECT page_id FROM cortex_page_aliases WHERE alias = $input OR alias = $slug LIMIT 1))
             LIMIT 1`
            )
            .get<PageRow>({ input: slugOrId, slug })) ?? null
    );
}

export async function toPage(db: CortexDatabase, row: PageRow): Promise<CortexPage> {
    return {
        ...toPageSummary(row),
        body: row.body,
        claims: await listClaims(db, row.id),
        compiledTruth: row.compiled_truth,
        createdAt: row.created_at,
        frontmatter: readJsonRecord(row.frontmatter_json),
        indexing: await getPageIndexing(db, row.id),
        links: await listPageLinks(db, row.id),
        sourceRefs: readJsonArray<CortexSourceRef>(row.source_refs_json),
        timeline: await listTimeline(db, row.id),
    };
}

async function getPageIndexing(
    db: CortexDatabase,
    pageId: string
): Promise<CortexPage['indexing']> {
    const embedding = (await getCortexSettings(db)).embedding;
    const row = await db
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
        .get<{
            chunkcount?: number;
            chunkCount: number;
            currentembeddingcount?: number | null;
            currentEmbeddingCount: number | null;
            lastembeddedat?: string | null;
            lastEmbeddedAt: string | null;
            missingembeddingcount?: number | null;
            missingEmbeddingCount: number | null;
            staleembeddingcount?: number | null;
            staleEmbeddingCount: number | null;
        }>({
            dimensions: embedding.dimensions,
            model: embedding.model,
            pageId,
            provider: embedding.provider,
        });
    const chunkCount = row?.chunkCount ?? row?.chunkcount ?? 0;
    const currentEmbeddingCount = row?.currentEmbeddingCount ?? row?.currentembeddingcount ?? 0;
    const missingEmbeddingCount = row?.missingEmbeddingCount ?? row?.missingembeddingcount ?? 0;
    const staleEmbeddingCount = row?.staleEmbeddingCount ?? row?.staleembeddingcount ?? 0;
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
        lastEmbeddedAt: row?.lastEmbeddedAt ?? row?.lastembeddedat ?? null,
        missingEmbeddingCount,
        staleEmbeddingCount,
        status,
    };
}

async function listClaims(db: CortexDatabase, pageId: string): Promise<CortexPage['claims']> {
    const rows = await db
        .prepare(
            `SELECT id, page_id, subject, predicate, value, confidence, status, source_refs_json, supersedes_claim_id
             FROM cortex_claims
             WHERE page_id = ?
             ORDER BY created_at ASC`
        )
        .all<ClaimRow>(pageId);
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

async function listTimeline(db: CortexDatabase, pageId: string): Promise<CortexPage['timeline']> {
    const rows = await db
        .prepare(
            `SELECT id, body, source_refs_json, created_at
             FROM cortex_timeline_entries
             WHERE page_id = ?
             ORDER BY created_at ASC`
        )
        .all<TimelineRow>(pageId);
    return rows.map((row) => ({
        body: row.body,
        createdAt: row.created_at,
        id: row.id,
        sourceRefs: readJsonArray<CortexSourceRef>(row.source_refs_json),
    }));
}

async function listPageLinks(db: CortexDatabase, pageId: string) {
    const rows = await db
        .prepare(
            `SELECT id, from_page_id, target_slug, target_page_id, heading, label, link_kind, source_location
             FROM cortex_links
             WHERE from_page_id = ?
             ORDER BY created_at ASC`
        )
        .all<LinkRow>(pageId);
    return rows.map(toLink);
}

async function count(db: CortexDatabase, table: string): Promise<number> {
    return (
        (await db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get<{ count: number }>()) ?? {
            count: 0,
        }
    ).count;
}

async function currentEncodingCount(
    db: CortexDatabase,
    embedding: CortexSettings['embedding']
): Promise<number> {
    return (
        (await db
            .prepare(
                `SELECT COUNT(*) AS count
             FROM cortex_encodings e
             JOIN cortex_chunks c ON c.id = e.chunk_id
             WHERE e.provider = ?
               AND e.model = ?
               AND e.dimensions = ?
               AND e.input_text_hash = c.text_hash`
            )
            .get<{ count: number }>(embedding.provider, embedding.model, embedding.dimensions)) ?? {
            count: 0,
        }
    ).count;
}

async function staleEncodingCount(
    db: CortexDatabase,
    embedding: CortexSettings['embedding']
): Promise<number> {
    return (
        (await db
            .prepare(
                `SELECT COUNT(*) AS count
             FROM cortex_encodings e
             JOIN cortex_chunks c ON c.id = e.chunk_id
             WHERE e.provider != ?
                OR e.model != ?
                OR e.dimensions != ?
                OR e.input_text_hash != c.text_hash`
            )
            .get<{ count: number }>(embedding.provider, embedding.model, embedding.dimensions)) ?? {
            count: 0,
        }
    ).count;
}

async function lastAuditAt(db: CortexDatabase, kind: string): Promise<string | null> {
    const row = await db
        .prepare(
            `SELECT created_at
             FROM cortex_audit_events
             WHERE kind = ?
             ORDER BY created_at DESC
             LIMIT 1`
        )
        .get<{ created_at: string }>(kind);
    return row?.created_at ?? null;
}

async function listRecentJobRuns(db: CortexDatabase): Promise<CortexStatus['jobRuns']> {
    const rows = await db
        .prepare(
            `SELECT kind, status, summary, created_at
             FROM cortex_audit_events
             WHERE kind LIKE 'job.%'
             ORDER BY created_at DESC
             LIMIT 10`
        )
        .all<{
            created_at: string;
            kind: string;
            status: 'error' | 'skipped' | 'success';
            summary: string;
        }>();
    return rows.map((row) => ({
        auditId: `audit:${row.kind}:${row.created_at}`,
        completedAt: row.created_at,
        job: toCortexJobName(row.kind.replace(/^job\./u, '')),
        status: row.status,
        summary: row.summary,
    }));
}

function toCortexJobName(jobSlug: string): CortexStatus['jobRuns'][number]['job'] {
    switch (jobSlug) {
        case 'sync':
        case 'cortex-sync':
            return 'sync';
        case 'generate-embeddings':
        case 'cortex-generate-embeddings':
            return 'generate-embeddings';
        case 'lint':
        case 'cortex-lint':
            return 'lint';
        case 'repair-derived-state':
        case 'cortex-repair-derived-state':
            return 'repair-derived-state';
        case 'cortex-chat-ingestion':
        case 'chat-ingestion':
            return 'chat-ingestion';
        case 'dream':
        case 'cortex-dream':
            return 'dream';
        default:
            return 'lint';
    }
}
