import { getActiveCortexSchema } from './cortex-schema';
import type { CortexDatabase } from './db';
import { getCortexSettings } from './settings';

export type CortexIssueKind =
    | 'broken-citation'
    | 'duplicate-page'
    | 'failed-capture'
    | 'failed-dream'
    | 'failed-chat-ingestion'
    | 'invalid-link-kind'
    | 'invalid-page-type'
    | 'missing-citation'
    | 'missing-chunks'
    | 'missing-cross-reference'
    | 'orphan-page'
    | 'stale-embedding'
    | 'stale-page'
    | 'unresolved-link'
    | 'unsourced-page'
    | 'without-timeline';

export interface CortexIssue {
    kind: CortexIssueKind;
    pageId?: string;
    severity?: CortexIssueSeverity;
    summary: string;
}

export type CortexIssueSeverity = 'error' | 'info' | 'warning';

export interface CortexHealthSummary {
    counts: Record<CortexIssueKind, number>;
    issueCount: number;
    score: number;
}

export async function detectCortexIssues(db: CortexDatabase): Promise<CortexIssue[]> {
    return [
        ...(await detectUnresolvedLinks(db)),
        ...(await detectInvalidLinkKinds(db)),
        ...(await detectInvalidPageTypes(db)),
        ...(await detectDuplicatePages(db)),
        ...(await detectUnsourcedPages(db)),
        ...(await detectMissingCitations(db)),
        ...(await detectBrokenCitations(db)),
        ...(await detectPagesWithoutTimeline(db)),
        ...(await detectStalePages(db)),
        ...(await detectOrphanPages(db)),
        ...(await detectMissingCrossReferences(db)),
        ...(await detectMissingChunks(db)),
        ...(await detectStaleEmbeddings(db)),
        ...(await detectFailedCaptures(db)),
        ...(await detectFailedChatIngestionAudits(db)),
        ...(await detectFailedDreamAudits(db)),
    ];
}

export function summarizeCortexHealth(issues: CortexIssue[]): CortexHealthSummary {
    const counts = Object.fromEntries(
        cortexIssueKinds.map((kind) => [kind, issues.filter((issue) => issue.kind === kind).length])
    ) as Record<CortexIssueKind, number>;
    const penalty = issues.reduce((total, issue) => total + severityPenalty(issue), 0);
    return {
        counts,
        issueCount: issues.length,
        score: Math.max(0, 100 - Math.min(100, penalty)),
    };
}

export function summarizeCortexIssues(issues: CortexIssue[]): string {
    const count = (kind: CortexIssueKind) => issues.filter((issue) => issue.kind === kind).length;
    return [
        `Lint: ${count('unresolved-link')} unresolved link(s)`,
        `${count('invalid-link-kind')} invalid link kind(s)`,
        `${count('invalid-page-type')} invalid page type(s)`,
        `${count('duplicate-page')} duplicate page candidate(s)`,
        `${count('unsourced-page')} unsourced page(s)`,
        `${count('missing-citation')} page(s) missing citations`,
        `${count('broken-citation')} broken citation ref(s)`,
        `${count('without-timeline')} page(s) without timeline evidence`,
        `${count('stale-page')} stale compiled truth page(s)`,
        `${count('orphan-page')} orphan page(s)`,
        `${count('missing-cross-reference')} missing cross-reference(s)`,
        `${count('missing-chunks')} page(s) missing chunks`,
        `${count('stale-embedding')} stale embedding issue(s)`,
        `${count('failed-capture')} failed capture(s)`,
        `${count('failed-chat-ingestion')} failed chat ingestion review(s)`,
        `${count('failed-dream')} failed Dream review(s).`,
    ].join(', ');
}

const cortexIssueKinds: CortexIssueKind[] = [
    'unresolved-link',
    'invalid-link-kind',
    'invalid-page-type',
    'duplicate-page',
    'unsourced-page',
    'missing-citation',
    'broken-citation',
    'without-timeline',
    'stale-page',
    'orphan-page',
    'missing-cross-reference',
    'missing-chunks',
    'stale-embedding',
    'failed-capture',
    'failed-chat-ingestion',
    'failed-dream',
];

function severityPenalty(issue: CortexIssue): number {
    switch (issue.severity ?? inferSeverity(issue.kind)) {
        case 'error':
            return 10;
        case 'warning':
            return 4;
        case 'info':
            return 1;
    }
}

function inferSeverity(kind: CortexIssueKind): CortexIssueSeverity {
    switch (kind) {
        case 'broken-citation':
        case 'failed-capture':
        case 'failed-chat-ingestion':
        case 'failed-dream':
        case 'invalid-link-kind':
        case 'invalid-page-type':
        case 'unresolved-link':
            return 'error';
        case 'duplicate-page':
        case 'missing-citation':
        case 'missing-cross-reference':
        case 'stale-embedding':
        case 'stale-page':
            return 'warning';
        case 'missing-chunks':
        case 'orphan-page':
        case 'unsourced-page':
        case 'without-timeline':
            return 'info';
    }
}

async function detectUnresolvedLinks(db: CortexDatabase): Promise<CortexIssue[]> {
    return (
        await db
            .prepare(
                `SELECT from_page_id, target_slug
                 FROM cortex_links
                 WHERE target_page_id IS NULL`
            )
            .all<{ from_page_id: string; target_slug: string }>()
    ).map((row) => ({
        kind: 'unresolved-link',
        pageId: row.from_page_id,
        severity: 'error',
        summary: `Unresolved link to ${row.target_slug}.`,
    }));
}

async function detectInvalidLinkKinds(db: CortexDatabase): Promise<CortexIssue[]> {
    const known = new Set((await getActiveCortexSchema(db)).linkTypes.map((type) => type.name));
    return (
        await db.prepare('SELECT from_page_id, link_kind FROM cortex_links').all<{
            from_page_id: string;
            link_kind: string;
        }>()
    )
        .filter((row) => !known.has(row.link_kind))
        .map((row) => ({
            kind: 'invalid-link-kind',
            pageId: row.from_page_id,
            severity: 'error',
            summary: `Invalid link kind ${row.link_kind}.`,
        }));
}

async function detectInvalidPageTypes(db: CortexDatabase): Promise<CortexIssue[]> {
    const known = new Set((await getActiveCortexSchema(db)).pageTypes);
    return (
        await db
            .prepare(
                `SELECT id, title, type
                 FROM cortex_pages
                 WHERE deleted_at IS NULL`
            )
            .all<{ id: string; title: string; type: string }>()
    )
        .filter((row) => !known.has(row.type))
        .map((row) => ({
            kind: 'invalid-page-type',
            pageId: row.id,
            severity: 'error',
            summary: `${row.title} uses unknown page type ${row.type}.`,
        }));
}

async function detectDuplicatePages(db: CortexDatabase): Promise<CortexIssue[]> {
    const rows = await db
        .prepare(
            `SELECT id, title
             FROM cortex_pages
             WHERE deleted_at IS NULL`
        )
        .all<{ id: string; title: string }>();
    const groups = new Map<string, { id: string; title: string }[]>();
    for (const row of rows) {
        const key = normalizeDuplicateTitle(row.title);
        if (!key) {
            continue;
        }
        groups.set(key, [...(groups.get(key) ?? []), row]);
    }
    return [...groups.values()]
        .filter((group) => group.length > 1)
        .flatMap((group) =>
            group.map((row) => ({
                kind: 'duplicate-page' as const,
                pageId: row.id,
                severity: 'warning' as const,
                summary: `${row.title} may duplicate ${group
                    .filter((other) => other.id !== row.id)
                    .map((other) => other.title)
                    .join(', ')}.`,
            }))
        );
}

async function detectUnsourcedPages(db: CortexDatabase): Promise<CortexIssue[]> {
    return (
        await db
            .prepare(
                `SELECT id, title
                 FROM cortex_pages
                 WHERE source_refs_json = '[]'
                   AND deleted_at IS NULL`
            )
            .all<{ id: string; title: string }>()
    ).map((row) => ({
        kind: 'unsourced-page',
        pageId: row.id,
        severity: 'info',
        summary: `${row.title} has no source refs.`,
    }));
}

async function detectPagesWithoutTimeline(db: CortexDatabase): Promise<CortexIssue[]> {
    return (
        await db
            .prepare(
                `SELECT p.id, p.title
                 FROM cortex_pages p
                 WHERE p.deleted_at IS NULL
                   AND NOT EXISTS (
                     SELECT 1 FROM cortex_timeline_entries t WHERE t.page_id = p.id
                   )`
            )
            .all<{ id: string; title: string }>()
    ).map((row) => ({
        kind: 'without-timeline',
        pageId: row.id,
        severity: 'info',
        summary: `${row.title} has no timeline evidence.`,
    }));
}

async function detectMissingCitations(db: CortexDatabase): Promise<CortexIssue[]> {
    return (
        await db
            .prepare(
                `SELECT p.id, p.title
                 FROM cortex_pages p
                 WHERE p.deleted_at IS NULL
                   AND p.source_refs_json != '[]'
                   AND NOT EXISTS (
                     SELECT 1 FROM cortex_citations c WHERE c.page_id = p.id
                   )`
            )
            .all<{ id: string; title: string }>()
    ).map((row) => ({
        kind: 'missing-citation',
        pageId: row.id,
        severity: 'warning',
        summary: `${row.title} has source refs but no citations.`,
    }));
}

async function detectBrokenCitations(db: CortexDatabase): Promise<CortexIssue[]> {
    return (
        await db
            .prepare(
                `SELECT c.id, c.page_id, c.source_id, c.locator
                 FROM cortex_citations c
                 LEFT JOIN cortex_pages p ON p.id = c.page_id
                 LEFT JOIN cortex_sources s ON s.id = c.source_id
                 WHERE (c.page_id IS NOT NULL AND p.id IS NULL)
                    OR (c.source_id IS NOT NULL AND s.id IS NULL)
                    OR (c.page_id IS NULL AND c.source_id IS NULL)`
            )
            .all<{
                id: string;
                locator: string;
                page_id: string | null;
                source_id: string | null;
            }>()
    ).map((row) => ({
        kind: 'broken-citation',
        pageId: row.page_id ?? undefined,
        severity: 'error',
        summary: `Citation ${row.id} has broken refs for ${row.locator}.`,
    }));
}

async function detectStalePages(db: CortexDatabase): Promise<CortexIssue[]> {
    return (
        await db
            .prepare(
                `SELECT p.id, p.title, MAX(t.created_at) AS latest_timeline_at
                 FROM cortex_pages p
                 JOIN cortex_timeline_entries t ON t.page_id = p.id
                 WHERE p.deleted_at IS NULL
                   AND p.status IN ('active', 'stale')
                 GROUP BY p.id, p.title, p.updated_at
                 HAVING MAX(t.created_at) > p.updated_at`
            )
            .all<{ id: string; latest_timeline_at: string; title: string }>()
    ).map((row) => ({
        kind: 'stale-page',
        pageId: row.id,
        severity: 'warning',
        summary: `${row.title} has newer timeline evidence than compiled truth.`,
    }));
}

async function detectOrphanPages(db: CortexDatabase): Promise<CortexIssue[]> {
    return (
        await db
            .prepare(
                `SELECT p.id, p.title
                 FROM cortex_pages p
                 WHERE p.deleted_at IS NULL
                   AND NOT EXISTS (
                     SELECT 1 FROM cortex_links l
                     WHERE l.target_page_id = p.id OR l.target_slug = p.slug
                   )`
            )
            .all<{ id: string; title: string }>()
    ).map((row) => ({
        kind: 'orphan-page',
        pageId: row.id,
        severity: 'info',
        summary: `${row.title} has zero inbound graph links.`,
    }));
}

async function detectMissingCrossReferences(db: CortexDatabase): Promise<CortexIssue[]> {
    const rows = await db
        .prepare(
            `SELECT id, slug, title, compiled_truth, body
             FROM cortex_pages
             WHERE deleted_at IS NULL
               AND status IN ('active', 'stale')
             ORDER BY updated_at DESC
             LIMIT 200`
        )
        .all<{
            body: string;
            compiled_truth: string;
            id: string;
            slug: string;
            title: string;
        }>();
    const linkRows = await db
        .prepare('SELECT from_page_id, target_page_id, target_slug FROM cortex_links')
        .all<{ from_page_id: string; target_page_id: string | null; target_slug: string }>();
    const existing = new Set(
        linkRows.flatMap((row) => [
            `${row.from_page_id}->${row.target_page_id ?? ''}`,
            `${row.from_page_id}->${row.target_slug}`,
        ])
    );
    const issues: CortexIssue[] = [];
    for (const source of rows) {
        const text = `${source.compiled_truth}\n${source.body}`;
        if (!text.trim()) {
            continue;
        }
        for (const target of rows) {
            if (source.id === target.id || !isCrossReferenceCandidate(target.title)) {
                continue;
            }
            if (
                existing.has(`${source.id}->${target.id}`) ||
                existing.has(`${source.id}->${target.slug}`)
            ) {
                continue;
            }
            if (mentionsTitle(text, target.title)) {
                issues.push({
                    kind: 'missing-cross-reference',
                    pageId: source.id,
                    severity: 'warning',
                    summary: `${source.title} mentions ${target.title} without a Cortex link.`,
                });
                if (issues.length >= 50) {
                    return issues;
                }
            }
        }
    }
    return issues;
}

async function detectMissingChunks(db: CortexDatabase): Promise<CortexIssue[]> {
    return (
        await db
            .prepare(
                `SELECT p.id, p.title
                 FROM cortex_pages p
                 WHERE p.deleted_at IS NULL
                   AND p.status IN ('active', 'stale')
                   AND NOT EXISTS (
                     SELECT 1 FROM cortex_chunks c WHERE c.page_id = p.id
                   )`
            )
            .all<{ id: string; title: string }>()
    ).map((row) => ({
        kind: 'missing-chunks',
        pageId: row.id,
        severity: 'info',
        summary: `${row.title} has no derived chunks.`,
    }));
}

async function detectStaleEmbeddings(db: CortexDatabase): Promise<CortexIssue[]> {
    const embedding = (await getCortexSettings(db)).embedding;
    return (
        await db
            .prepare(
                `SELECT c.page_id
                 FROM cortex_chunks c
                 JOIN cortex_pages p ON p.id = c.page_id
                 LEFT JOIN cortex_encodings e
                   ON e.chunk_id = c.id
                  AND e.provider = $provider
                  AND e.model = $model
                  AND e.dimensions = $dimensions
                 WHERE p.deleted_at IS NULL
                   AND p.status IN ('active', 'stale')
                   AND (e.id IS NULL OR e.input_text_hash != c.text_hash)
                 GROUP BY c.page_id`
            )
            .all<{ page_id: string }>({
                dimensions: embedding.dimensions,
                model: embedding.model,
                provider: embedding.provider,
            })
    ).map((row) => ({
        kind: 'stale-embedding',
        pageId: row.page_id,
        severity: 'warning',
        summary: 'Chunk embedding is stale.',
    }));
}

async function detectFailedCaptures(db: CortexDatabase): Promise<CortexIssue[]> {
    return (
        await db
            .prepare(
                `SELECT id, error_message
                 FROM cortex_captures
                 WHERE status = 'error'`
            )
            .all<{ error_message: string | null; id: string }>()
    ).map((row) => ({
        kind: 'failed-capture',
        severity: 'error',
        summary: row.error_message ?? `Capture ${row.id} failed.`,
    }));
}

async function detectFailedDreamAudits(db: CortexDatabase): Promise<CortexIssue[]> {
    return (
        await db
            .prepare(
                `SELECT id, summary
                 FROM cortex_audit_events
                 WHERE kind = 'dream.review'
                   AND status = 'error'`
            )
            .all<{ id: string; summary: string }>()
    ).map((row) => ({
        kind: 'failed-dream',
        severity: 'error',
        summary: row.summary || `Dream review ${row.id} failed.`,
    }));
}

async function detectFailedChatIngestionAudits(db: CortexDatabase): Promise<CortexIssue[]> {
    return (
        await db
            .prepare(
                `SELECT id, summary
                 FROM cortex_audit_events
                 WHERE kind = 'chat_ingestion.review'
                   AND status = 'error'`
            )
            .all<{ id: string; summary: string }>()
    ).map((row) => ({
        kind: 'failed-chat-ingestion',
        severity: 'error',
        summary: row.summary || `Chat ingestion review ${row.id} failed.`,
    }));
}

function normalizeDuplicateTitle(title: string): string {
    return title.trim().replace(/\s+/g, ' ').toLowerCase();
}

function isCrossReferenceCandidate(title: string): boolean {
    return title.trim().length >= 6 && /\p{L}/u.test(title);
}

function mentionsTitle(text: string, title: string): boolean {
    return new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegex(title)}([^\\p{L}\\p{N}]|$)`, 'iu').test(
        text
    );
}

function escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
