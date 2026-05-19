import type {
    CortexBacklinkList,
    CortexPage,
    CortexPageList,
    CortexRecallInput,
    CortexRecallResult,
    CortexSearchInput,
    CortexSearchResult,
    CortexSourceRef,
    CortexStatus,
} from '@tavern/api';
import { DATA_DIR, RUNTIME_ROOT } from '../config';
import type { Database } from '../db/sqlite';
import { writeCortexAudit } from './audit';
import {
    cortexEncodingDimensions,
    cortexEncodingModel,
    cortexEncodingProvider,
    cosineSimilarity,
    encodeCortexText,
} from './encoding';
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

export function searchCortex(db: Database, input: CortexSearchInput): CortexSearchResult {
    const queryTerms = tokenize(input.query);
    const queryVector = encodeCortexText(input.query);
    const rows = db
        .prepare(
            `SELECT p.id AS page_id,
                    p.title || ' ' || p.slug || ' ' || p.compiled_truth || ' ' || p.body AS score_text,
                    e.vector_json
             FROM cortex_pages p
             LEFT JOIN cortex_chunks c ON c.page_id = p.id
             LEFT JOIN cortex_encodings e ON e.chunk_id = c.id
             WHERE p.deleted_at IS NULL`
        )
        .all() as ChunkEncodingRow[];
    const scores = new Map<string, number>();

    for (const row of rows) {
        const lexical = scoreLexical(row.score_text, queryTerms);
        const vector = row.vector_json
            ? cosineSimilarity(JSON.parse(row.vector_json) as number[], queryVector)
            : 0;
        scores.set(row.page_id, Math.max(scores.get(row.page_id) ?? 0, lexical + vector));
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

    return { hits, query: input.query };
}

export function recallCortex(db: Database, input: CortexRecallInput): CortexRecallResult {
    const result = searchCortex(db, input);
    const auditId = writeCortexAudit(db, {
        kind: 'recall',
        recordRefs: result.hits.map((hit) => hit.page.id),
        sourceRefs: [],
        status: 'success',
        summary: `Recalled ${result.hits.length} Cortex page(s).`,
    });
    return {
        auditId,
        hits: result.hits.map((hit) => ({ ...hit, evidence: [] })),
        query: result.query,
    };
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

export function getCortexStatus(db: Database): CortexStatus {
    return {
        auditCount: count(db, 'cortex_audit_events'),
        captureCount: count(db, 'cortex_captures'),
        chunkCount: count(db, 'cortex_chunks'),
        claimCount: count(db, 'cortex_claims'),
        databasePath: cortexDatabasePath,
        encoding: {
            currentCount: currentEncodingCount(db),
            dimensions: cortexEncodingDimensions,
            model: cortexEncodingModel,
            provider: cortexEncodingProvider,
            staleCount: staleEncodingCount(db),
            totalCount: count(db, 'cortex_encodings'),
        },
        jobRuns: listRecentJobRuns(db),
        lastCaptureAt: lastAuditAt(db, 'capture'),
        lastRecallAt: lastAuditAt(db, 'recall'),
        lastRepairAt: lastAuditAt(db, 'job.repair'),
        linkCount: count(db, 'cortex_links'),
        pageCount: count(db, 'cortex_pages'),
        sourceCount: count(db, 'cortex_sources'),
        timelineEntryCount: count(db, 'cortex_timeline_entries'),
        wikiPath: resolveCortexWikiPath(),
    };
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
        links: listPageLinks(db, row.id),
        sourceRefs: readJsonArray<CortexSourceRef>(row.source_refs_json),
        timeline: listTimeline(db, row.id),
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

function currentEncodingCount(db: Database): number {
    return (
        db
            .prepare(
                `SELECT COUNT(*) AS count
             FROM cortex_encodings e
             JOIN cortex_chunks c ON c.id = e.chunk_id
             WHERE e.input_text_hash = c.text_hash`
            )
            .get() as { count: number }
    ).count;
}

function staleEncodingCount(db: Database): number {
    return (
        db
            .prepare(
                `SELECT COUNT(*) AS count
             FROM cortex_encodings e
             JOIN cortex_chunks c ON c.id = e.chunk_id
             WHERE e.input_text_hash != c.text_hash`
            )
            .get() as { count: number }
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
