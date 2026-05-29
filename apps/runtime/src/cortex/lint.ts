import type { Database } from '../db/sqlite';
import { getActiveCortexSchema } from './cortex-schema';
import { getCortexSettings } from './settings';

export type CortexIssueKind =
    | 'failed-capture'
    | 'failed-dream'
    | 'failed-signal'
    | 'invalid-link-kind'
    | 'missing-citation'
    | 'missing-chunks'
    | 'orphan-page'
    | 'stale-embedding'
    | 'unresolved-link'
    | 'unsourced-page'
    | 'without-timeline';

export interface CortexIssue {
    kind: CortexIssueKind;
    pageId?: string;
    summary: string;
}

export function detectCortexIssues(db: Database): CortexIssue[] {
    return [
        ...detectUnresolvedLinks(db),
        ...detectInvalidLinkKinds(db),
        ...detectUnsourcedPages(db),
        ...detectMissingCitations(db),
        ...detectPagesWithoutTimeline(db),
        ...detectOrphanPages(db),
        ...detectMissingChunks(db),
        ...detectStaleEmbeddings(db),
        ...detectFailedCaptures(db),
        ...detectFailedSignalAudits(db),
        ...detectFailedDreamAudits(db),
    ];
}

export function summarizeCortexIssues(issues: CortexIssue[]): string {
    const count = (kind: CortexIssueKind) => issues.filter((issue) => issue.kind === kind).length;
    return [
        `Lint: ${count('unresolved-link')} unresolved link(s)`,
        `${count('invalid-link-kind')} invalid link kind(s)`,
        `${count('unsourced-page')} unsourced page(s)`,
        `${count('missing-citation')} page(s) missing citations`,
        `${count('without-timeline')} page(s) without timeline evidence`,
        `${count('orphan-page')} orphan page(s)`,
        `${count('missing-chunks')} page(s) missing chunks`,
        `${count('stale-embedding')} stale embedding issue(s)`,
        `${count('failed-capture')} failed capture(s)`,
        `${count('failed-signal')} failed Signal review(s)`,
        `${count('failed-dream')} failed Dream review(s).`,
    ].join(', ');
}

function detectUnresolvedLinks(db: Database): CortexIssue[] {
    return (
        db
            .prepare(
                `SELECT from_page_id, target_slug
                 FROM cortex_links
                 WHERE target_page_id IS NULL`
            )
            .all() as Array<{ from_page_id: string; target_slug: string }>
    ).map((row) => ({
        kind: 'unresolved-link',
        pageId: row.from_page_id,
        summary: `Unresolved link to ${row.target_slug}.`,
    }));
}

function detectInvalidLinkKinds(db: Database): CortexIssue[] {
    const known = new Set(getActiveCortexSchema(db).linkTypes.map((type) => type.name));
    return (
        db.prepare('SELECT from_page_id, link_kind FROM cortex_links').all() as Array<{
            from_page_id: string;
            link_kind: string;
        }>
    )
        .filter((row) => !known.has(row.link_kind))
        .map((row) => ({
            kind: 'invalid-link-kind',
            pageId: row.from_page_id,
            summary: `Invalid link kind ${row.link_kind}.`,
        }));
}

function detectUnsourcedPages(db: Database): CortexIssue[] {
    return (
        db
            .prepare(
                `SELECT id, title
                 FROM cortex_pages
                 WHERE source_refs_json = '[]'
                   AND deleted_at IS NULL`
            )
            .all() as Array<{ id: string; title: string }>
    ).map((row) => ({
        kind: 'unsourced-page',
        pageId: row.id,
        summary: `${row.title} has no source refs.`,
    }));
}

function detectPagesWithoutTimeline(db: Database): CortexIssue[] {
    return (
        db
            .prepare(
                `SELECT p.id, p.title
                 FROM cortex_pages p
                 WHERE p.deleted_at IS NULL
                   AND NOT EXISTS (
                     SELECT 1 FROM cortex_timeline_entries t WHERE t.page_id = p.id
                   )`
            )
            .all() as Array<{ id: string; title: string }>
    ).map((row) => ({
        kind: 'without-timeline',
        pageId: row.id,
        summary: `${row.title} has no timeline evidence.`,
    }));
}

function detectMissingCitations(db: Database): CortexIssue[] {
    return (
        db
            .prepare(
                `SELECT p.id, p.title
                 FROM cortex_pages p
                 WHERE p.deleted_at IS NULL
                   AND p.source_refs_json != '[]'
                   AND NOT EXISTS (
                     SELECT 1 FROM cortex_citations c WHERE c.page_id = p.id
                   )`
            )
            .all() as Array<{ id: string; title: string }>
    ).map((row) => ({
        kind: 'missing-citation',
        pageId: row.id,
        summary: `${row.title} has source refs but no citations.`,
    }));
}

function detectOrphanPages(db: Database): CortexIssue[] {
    return (
        db
            .prepare(
                `SELECT p.id, p.title
                 FROM cortex_pages p
                 WHERE p.deleted_at IS NULL
                   AND NOT EXISTS (
                     SELECT 1 FROM cortex_links l
                     WHERE l.from_page_id = p.id OR l.target_page_id = p.id
                   )`
            )
            .all() as Array<{ id: string; title: string }>
    ).map((row) => ({
        kind: 'orphan-page',
        pageId: row.id,
        summary: `${row.title} has no graph links.`,
    }));
}

function detectMissingChunks(db: Database): CortexIssue[] {
    return (
        db
            .prepare(
                `SELECT p.id, p.title
                 FROM cortex_pages p
                 WHERE p.deleted_at IS NULL
                   AND p.status IN ('active', 'stale')
                   AND NOT EXISTS (
                     SELECT 1 FROM cortex_chunks c WHERE c.page_id = p.id
                   )`
            )
            .all() as Array<{ id: string; title: string }>
    ).map((row) => ({
        kind: 'missing-chunks',
        pageId: row.id,
        summary: `${row.title} has no derived chunks.`,
    }));
}

function detectStaleEmbeddings(db: Database): CortexIssue[] {
    const embedding = getCortexSettings(db).embedding;
    return (
        db
            .prepare(
                `SELECT c.page_id
                 FROM cortex_chunks c
                 LEFT JOIN cortex_encodings e
                   ON e.chunk_id = c.id
                  AND e.provider = $provider
                  AND e.model = $model
                  AND e.dimensions = $dimensions
                 WHERE e.id IS NULL
                    OR e.input_text_hash != c.text_hash
                 GROUP BY c.page_id`
            )
            .all({
                $dimensions: embedding.dimensions,
                $model: embedding.model,
                $provider: embedding.provider,
            }) as Array<{ page_id: string }>
    ).map((row) => ({
        kind: 'stale-embedding',
        pageId: row.page_id,
        summary: 'Chunk embedding is stale.',
    }));
}

function detectFailedCaptures(db: Database): CortexIssue[] {
    return (
        db
            .prepare(
                `SELECT id, error_message
                 FROM cortex_captures
                 WHERE status = 'error'`
            )
            .all() as Array<{ error_message: string | null; id: string }>
    ).map((row) => ({
        kind: 'failed-capture',
        summary: row.error_message ?? `Capture ${row.id} failed.`,
    }));
}

function detectFailedDreamAudits(db: Database): CortexIssue[] {
    return (
        db
            .prepare(
                `SELECT id, summary
                 FROM cortex_audit_events
                 WHERE kind = 'dream.review'
                   AND status = 'error'`
            )
            .all() as Array<{ id: string; summary: string }>
    ).map((row) => ({
        kind: 'failed-dream',
        summary: row.summary || `Dream review ${row.id} failed.`,
    }));
}

function detectFailedSignalAudits(db: Database): CortexIssue[] {
    return (
        db
            .prepare(
                `SELECT id, summary
                 FROM cortex_audit_events
                 WHERE kind = 'signal.review'
                   AND status = 'error'`
            )
            .all() as Array<{ id: string; summary: string }>
    ).map((row) => ({
        kind: 'failed-signal',
        summary: row.summary || `Signal review ${row.id} failed.`,
    }));
}
