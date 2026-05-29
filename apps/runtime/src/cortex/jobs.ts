import type { AgentRuntimeJobSlug, CortexJobName, CortexJobRun } from '@tavern/api';
import type { Database } from '../db/sqlite';
import { namedParams } from '../db/sqlite';
import { writeCortexAudit } from './audit';
import { refreshDerivedPageState } from './derive';
import { runCortexDream } from './dream';
import { embedCortexText } from './encoding';
import { createCortexId } from './ids';
import { detectCortexIssues, summarizeCortexIssues } from './lint';
import { nowIso, type PageRow } from './rows';
import { getCortexSettings } from './settings';
import { runCortexSignal } from './signal';
import { syncCortexMarkdown } from './sync';
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
    vectorDatabase: CortexVectorDatabase,
    options: { recordRuntimeRun?: boolean } = {}
): Promise<CortexJobRun> {
    const startedAt = nowIso();
    try {
        const summary = await runJobSteps(db, job, startedAt, vectorDatabase);
        const completedAt = nowIso();
        const run = writeCortexJobAudit(db, {
            completedAt,
            job,
            startedAt,
            status: 'success',
            summary,
        });
        if (options.recordRuntimeRun) {
            writeDirectRuntimeJobRun(db, {
                auditId: run.auditId,
                completedAt,
                errorMessage: null,
                job,
                startedAt,
                state: 'completed',
                summary,
            });
        }
        return run;
    } catch (error) {
        const errorMessage = readErrorMessage(error);
        const completedAt = nowIso();
        const run = writeCortexJobAudit(db, {
            completedAt,
            job,
            startedAt,
            status: 'error',
            summary: errorMessage,
        });
        if (options.recordRuntimeRun) {
            writeDirectRuntimeJobRun(db, {
                auditId: run.auditId,
                completedAt,
                errorMessage,
                job,
                startedAt,
                state: 'failed',
                summary: errorMessage,
            });
        }
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
    return writeCortexJobAudit(db, {
        completedAt,
        job,
        startedAt,
        status: 'skipped',
        summary,
    });
}

function writeCortexJobAudit(
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

    return {
        auditId,
        completedAt: input.completedAt,
        job: input.job,
        status: input.status,
        summary: input.summary,
    };
}

function writeDirectRuntimeJobRun(
    db: Database,
    input: {
        auditId: string;
        completedAt: string;
        errorMessage: string | null;
        job: CortexJobName;
        startedAt: string;
        state: 'completed' | 'failed';
        summary: string;
    }
): void {
    if (!hasRuntimeJobRunsTable(db)) {
        return;
    }
    const definition = runtimeJobDetails(input.job);
    db.prepare(
        `INSERT INTO runtime_job_runs
         (id, job_slug, job_display_name, trigger, state, attempts_made, progress, error,
          logs_json, metadata_json, created_at, started_at, finished_at, updated_at)
         VALUES ($id, $jobSlug, $jobDisplayName, 'manual', $state, 1, $progress, $error,
          $logsJson, $metadataJson, $createdAt, $startedAt, $finishedAt, $updatedAt)`
    ).run(
        namedParams({
            createdAt: input.startedAt,
            error: input.errorMessage,
            finishedAt: input.completedAt,
            id: createCortexId('rtjob'),
            jobDisplayName: definition.displayName,
            jobSlug: definition.slug,
            logsJson: JSON.stringify([input.summary]),
            metadataJson: JSON.stringify({ auditId: input.auditId }),
            progress: input.state === 'completed' ? 100 : 0,
            startedAt: input.startedAt,
            state: input.state,
            updatedAt: input.completedAt,
        })
    );
}

function hasRuntimeJobRunsTable(db: Database): boolean {
    return Boolean(
        db
            .prepare(
                `SELECT name
             FROM sqlite_master
             WHERE type = 'table' AND name = 'runtime_job_runs'
             LIMIT 1`
            )
            .get()
    );
}

function runtimeJobDetails(job: CortexJobName): {
    displayName: string;
    slug: AgentRuntimeJobSlug;
} {
    switch (job) {
        case 'dream':
            return { displayName: 'Cortex Dream', slug: 'cortex-dream' };
        case 'generate-embeddings':
            return {
                displayName: 'Generate Cortex Embeddings',
                slug: 'cortex-generate-embeddings',
            };
        case 'lint':
            return { displayName: 'Lint Cortex Knowledgebase', slug: 'cortex-lint' };
        case 'maintenance':
            return { displayName: 'Cortex Maintenance', slug: 'cortex-maintenance' };
        case 'signal':
            return { displayName: 'Cortex Signal', slug: 'cortex-signal' };
        case 'sync':
            return { displayName: 'Sync Cortex', slug: 'cortex-sync' };
    }
}

async function runJobSteps(
    db: Database,
    job: CortexJobName,
    now: string,
    vectorDatabase: CortexVectorDatabase
): Promise<string> {
    switch (job) {
        case 'sync': {
            const result = syncCortexMarkdown(db);
            return `Synced ${result.pagesSynced} Cortex markdown page(s).`;
        }
        case 'generate-embeddings': {
            const records = await generateStaleCortexEmbeddings(db, now);
            await vectorDatabase.upsert(records);
            return `Generated embeddings for ${records.length} Cortex chunk(s).`;
        }
        case 'lint':
            return summarizeCortexIssues(detectCortexIssues(db));
        case 'maintenance': {
            const before = detectCortexIssues(db);
            const pages = listPages(db);
            for (const page of pages) {
                refreshDerivedPageState(db, page, now);
            }
            cleanOrphanDerivedRows(db);
            const after = detectCortexIssues(db);
            return `Repaired derived Cortex links and chunks for ${pages.length} page(s); issues ${before.length} -> ${after.length}.`;
        }
        case 'signal': {
            const result = await runCortexSignal(db);
            const mode = result.modelReviewed ? 'with model review' : 'without model review';
            return `Signal reviewed ${result.reviewed} chat message(s) across ${result.chatsReviewed} chat(s) ${mode}; captured ${result.captured} Cortex memory page(s).`;
        }
        case 'dream': {
            const result = await runCortexDream(db);
            const mode = result.modelReviewed ? 'with model review' : 'without model review';
            return `Reviewed ${result.reviewed} recent chat message(s) ${mode}; captured ${result.captured} Cortex memory page(s).`;
        }
    }
}

function cleanOrphanDerivedRows(db: Database): void {
    db.prepare(
        `DELETE FROM cortex_links
         WHERE from_page_id NOT IN (SELECT id FROM cortex_pages WHERE deleted_at IS NULL)`
    ).run();
    db.prepare(
        `DELETE FROM cortex_chunks
         WHERE page_id IS NOT NULL
           AND page_id NOT IN (SELECT id FROM cortex_pages WHERE deleted_at IS NULL)`
    ).run();
    db.prepare(
        `DELETE FROM cortex_timeline_entries
         WHERE page_id NOT IN (SELECT id FROM cortex_pages WHERE deleted_at IS NULL)`
    ).run();
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

export async function generateStaleCortexEmbeddings(
    db: Database,
    now: string
): Promise<VectorRecord[]> {
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

function readErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message.trim()) {
        return error.message;
    }
    return 'Cortex job failed.';
}
