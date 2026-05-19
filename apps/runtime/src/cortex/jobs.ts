import type { CortexJobName, CortexJobRun } from '@tavern/api';
import type { Database } from '../db/sqlite';
import { namedParams } from '../db/sqlite';
import { writeCortexAudit } from './audit';
import { refreshDerivedPageState } from './derive';
import { createCortexId } from './ids';
import { writeMarkdownMirror } from './mirror';
import { toPage } from './read';
import { nowIso, type PageRow } from './rows';

export function runCortexJob(db: Database, job: CortexJobName): CortexJobRun {
    const startedAt = nowIso();
    const summary = runJobSteps(db, job, startedAt);
    const completedAt = nowIso();
    const auditId = writeCortexAudit(db, {
        kind: `job.${job}`,
        recordRefs: [],
        sourceRefs: [],
        status: 'success',
        summary,
    });

    db.prepare(
        `INSERT INTO cortex_job_runs
         (id, audit_id, job_name, status, summary, records_json, started_at, completed_at)
         VALUES ($id, $auditId, $job, 'success', $summary, '[]', $startedAt, $completedAt)`
    ).run(
        namedParams({
            auditId,
            completedAt,
            id: createCortexId('ctxjr'),
            job,
            startedAt,
            summary,
        })
    );

    return { auditId, completedAt, job, status: 'success', summary };
}

function runJobSteps(db: Database, job: CortexJobName, now: string): string {
    switch (job) {
        case 'recall-index': {
            const pages = listPages(db);
            for (const page of pages) {
                refreshDerivedPageState(db, page, now);
            }
            return `Rebuilt recall indexes for ${pages.length} page(s).`;
        }
        case 'export': {
            const pages = listPages(db);
            for (const page of pages) {
                writeMarkdownMirror(toPage(db, page));
            }
            return `Exported ${pages.length} Cortex markdown page(s).`;
        }
        case 'health':
            return summarizeHealth(db);
        case 'ingest':
            return 'No queued Cortex ingest work.';
        case 'lint':
            return summarizeLint(db);
        case 'repair': {
            const pages = listPages(db);
            for (const page of pages) {
                refreshDerivedPageState(db, page, now);
                writeMarkdownMirror(toPage(db, page));
            }
            return `Repaired derived state and markdown mirrors for ${pages.length} page(s).`;
        }
    }
}

function listPages(db: Database): PageRow[] {
    return db.prepare('SELECT * FROM cortex_pages WHERE deleted_at IS NULL').all() as PageRow[];
}

function summarizeHealth(db: Database): string {
    const pageCount = count(db, 'cortex_pages');
    const chunkCount = count(db, 'cortex_chunks');
    const currentEncodingCount = countWhere(
        db,
        `SELECT COUNT(*)
         FROM cortex_encodings e
         JOIN cortex_chunks c ON c.id = e.chunk_id
         WHERE e.input_text_hash = c.text_hash`
    );
    const unresolvedLinkCount = countWhere(
        db,
        'SELECT COUNT(*) FROM cortex_links WHERE target_page_id IS NULL'
    );
    return `Health: ${pageCount} page(s), ${chunkCount} chunk(s), ${currentEncodingCount} current encoding(s), ${unresolvedLinkCount} unresolved link(s).`;
}

function summarizeLint(db: Database): string {
    const unresolvedLinkCount = countWhere(
        db,
        'SELECT COUNT(*) FROM cortex_links WHERE target_page_id IS NULL'
    );
    const unsourcedPageCount = countWhere(
        db,
        "SELECT COUNT(*) FROM cortex_pages WHERE source_refs_json = '[]' AND deleted_at IS NULL"
    );
    const pagesWithoutTimelineCount = countWhere(
        db,
        `SELECT COUNT(*)
         FROM cortex_pages p
         WHERE p.deleted_at IS NULL
           AND NOT EXISTS (
             SELECT 1 FROM cortex_timeline_entries t WHERE t.page_id = p.id
           )`
    );
    return `Lint: ${unresolvedLinkCount} unresolved link(s), ${unsourcedPageCount} unsourced page(s), ${pagesWithoutTimelineCount} page(s) without timeline evidence.`;
}

function count(db: Database, table: string): number {
    return countWhere(db, `SELECT COUNT(*) FROM ${table}`);
}

function countWhere(db: Database, sql: string): number {
    return Number((db.prepare(sql).get() as { 'COUNT(*)': number })['COUNT(*)']);
}
