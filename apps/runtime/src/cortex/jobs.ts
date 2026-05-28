import type { CortexJobName, CortexJobRun } from '@tavern/api';
import type { Database } from '../db/sqlite';
import { namedParams } from '../db/sqlite';
import { writeCortexAudit } from './audit';
import { refreshDerivedPageState } from './derive';
import { embedCortexText } from './encoding';
import { createCortexId } from './ids';
import { writeMarkdownMirror } from './mirror';
import { toPage } from './read';
import { nowIso, type PageRow } from './rows';
import { getCortexSettings } from './settings';
import type { CortexVectorDatabase, VectorRecord } from './vector-db/types';

export function countCortexEmbeddingBacklog(db: Database): number {
    const embeddingSettings = getCortexSettings(db).embedding;
    return (
        db
            .prepare(
                `SELECT COUNT(*) AS count
                 FROM cortex_chunks c
                 JOIN cortex_pages p ON p.id = c.page_id
                 LEFT JOIN cortex_encodings e
                   ON e.chunk_id = c.id
                  AND e.provider = $provider
                  AND e.model = $model
                  AND e.dimensions = $dimensions
                 WHERE p.deleted_at IS NULL
                   AND p.status IN ('active', 'stale')
                   AND (e.id IS NULL OR e.input_text_hash != c.text_hash)`
            )
            .get(
                namedParams({
                    dimensions: embeddingSettings.dimensions,
                    model: embeddingSettings.model,
                    provider: embeddingSettings.provider,
                })
            ) as { count: number }
    ).count;
}

export async function runCortexJob(
    db: Database,
    job: CortexJobName,
    vectorDatabase: CortexVectorDatabase
): Promise<CortexJobRun> {
    const startedAt = nowIso();
    try {
        const summary = await runJobSteps(db, job, startedAt, vectorDatabase);
        return writeCortexJobRun(db, {
            completedAt: nowIso(),
            job,
            startedAt,
            status: 'success',
            summary,
        });
    } catch (error) {
        writeCortexJobRun(db, {
            completedAt: nowIso(),
            errorMessage: readErrorMessage(error),
            job,
            startedAt,
            status: 'error',
            summary: readErrorMessage(error),
        });
        throw error;
    }
}

export function recordSkippedCortexJob(
    db: Database,
    job: CortexJobName,
    summary: string
): CortexJobRun {
    const startedAt = nowIso();
    const completedAt = nowIso();
    return writeCortexJobRun(db, {
        completedAt,
        job,
        startedAt,
        status: 'skipped',
        summary,
    });
}

function writeCortexJobRun(
    db: Database,
    input: {
        completedAt: string;
        errorMessage?: string;
        job: CortexJobName;
        startedAt: string;
        status: 'error' | 'skipped' | 'success';
        summary: string;
    }
): CortexJobRun {
    const auditId = writeCortexAudit(db, {
        kind: `job.${input.job}`,
        recordRefs: [],
        sourceRefs: [],
        status: input.status,
        summary: input.summary,
    });

    db.prepare(
        `INSERT INTO cortex_job_runs
         (id, audit_id, job_name, status, summary, records_json, error_message, started_at, completed_at)
         VALUES ($id, $auditId, $job, $status, $summary, '[]', $errorMessage, $startedAt, $completedAt)`
    ).run(
        namedParams({
            auditId,
            completedAt: input.completedAt,
            errorMessage: input.errorMessage ?? null,
            id: createCortexId('ctxjr'),
            job: input.job,
            startedAt: input.startedAt,
            status: input.status,
            summary: input.summary,
        })
    );

    return {
        auditId,
        completedAt: input.completedAt,
        job: input.job,
        status: input.status,
        summary: input.summary,
    };
}

async function runJobSteps(
    db: Database,
    job: CortexJobName,
    now: string,
    vectorDatabase: CortexVectorDatabase
): Promise<string> {
    switch (job) {
        case 'generate-embeddings': {
            const pages = listPages(db);
            for (const page of pages) {
                refreshDerivedPageState(db, page, now);
            }
            const records = await buildVectorRecords(db, now);
            await vectorDatabase.upsert(records);
            return `Generated embeddings for ${records.length} Cortex chunk(s) across ${pages.length} page(s).`;
        }
        case 'ingest':
            return 'No queued Cortex ingest work.';
        case 'lint':
            return summarizeLint(db);
        case 'maintenance': {
            const pages = listPages(db);
            for (const page of pages) {
                refreshDerivedPageState(db, page, now);
                writeMarkdownMirror(toPage(db, page));
            }
            const records = await buildVectorRecords(db, now);
            await vectorDatabase.upsert(records);
            return `Repaired derived state, vector index, and markdown mirrors for ${pages.length} page(s).`;
        }
    }
}

function listPages(db: Database): PageRow[] {
    return db.prepare('SELECT * FROM cortex_pages WHERE deleted_at IS NULL').all() as PageRow[];
}

interface ChunkRow {
    id: string;
    page_id: string;
    section: string;
    source_id: string | null;
    text: string;
    text_hash: string;
}

async function buildVectorRecords(db: Database, now: string): Promise<VectorRecord[]> {
    const embeddingSettings = getCortexSettings(db).embedding;
    const rows = db
        .prepare(
            `SELECT c.id,
                    c.page_id,
                    c.source_id,
                    c.section,
                    c.text,
                    c.text_hash
             FROM cortex_chunks c
             JOIN cortex_pages p ON p.id = c.page_id
             LEFT JOIN cortex_encodings e
               ON e.chunk_id = c.id
              AND e.provider = $provider
              AND e.model = $model
              AND e.dimensions = $dimensions
             WHERE p.deleted_at IS NULL
               AND p.status IN ('active', 'stale')
               AND (e.id IS NULL OR e.input_text_hash != c.text_hash)`
        )
        .all(
            namedParams({
                dimensions: embeddingSettings.dimensions,
                model: embeddingSettings.model,
                provider: embeddingSettings.provider,
            })
        ) as ChunkRow[];

    const records: VectorRecord[] = [];
    for (const row of rows) {
        const embedding = await embedCortexText(db, row.text);
        if (!embedding) {
            continue;
        }
        upsertEncodingMetadata(db, {
            chunkId: row.id,
            dimensions: embedding.dimensions,
            model: embedding.model,
            now,
            provider: embedding.provider,
            textHash: row.text_hash,
            vector: embedding.vector,
        });

        records.push({
            chunkId: row.id,
            dimensions: embedding.dimensions,
            model: embedding.model,
            pageId: row.page_id,
            provider: embedding.provider,
            section: row.section,
            sourceId: row.source_id,
            textHash: row.text_hash,
            vector: embedding.vector,
        });
    }

    return records;
}

function upsertEncodingMetadata(
    db: Database,
    input: {
        chunkId: string;
        dimensions: number;
        model: string;
        now: string;
        provider: string;
        textHash: string;
        vector: number[];
    }
) {
    db.prepare(
        `INSERT INTO cortex_encodings
         (id, chunk_id, provider, model, dimensions, vector_json, input_text_hash, embedded_at)
         VALUES ($id, $chunkId, $provider, $model, $dimensions, $vectorJson, $textHash, $embeddedAt)
         ON CONFLICT(chunk_id, provider, model, dimensions) DO UPDATE SET
           vector_json = excluded.vector_json,
           input_text_hash = excluded.input_text_hash,
           embedded_at = excluded.embedded_at`
    ).run(
        namedParams({
            chunkId: input.chunkId,
            dimensions: input.dimensions,
            embeddedAt: input.now,
            id: createCortexId('ctxe'),
            model: input.model,
            provider: input.provider,
            textHash: input.textHash,
            vectorJson: JSON.stringify(input.vector),
        })
    );
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

function readErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message.trim()) {
        return error.message;
    }
    return 'Cortex job failed.';
}

function countWhere(db: Database, sql: string): number {
    return Number((db.prepare(sql).get() as { 'COUNT(*)': number })['COUNT(*)']);
}
