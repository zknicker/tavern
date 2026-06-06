import type {
    CortexDreamReport,
    CortexDreamReportHealth,
    CortexDreamReportItem,
    CortexDreamReportItemKind,
    CortexDreamReportPhase,
    CortexDreamReportStatus,
} from '@tavern/api';
import type { CortexDatabase } from './db';
import { createCortexId } from './ids';
import { nowIso, readJsonArray, readJsonRecord } from './rows';

export interface StartCortexDreamReportInput {
    healthBefore: CortexDreamReportHealth | null;
    model: string | null;
    provider: string | null;
    startedAt?: string;
}

export interface FinishCortexDreamReportInput {
    completedAt?: string;
    estimatedCostUsd?: number | null;
    healthAfter?: CortexDreamReportHealth | null;
    healthBefore?: CortexDreamReportHealth | null;
    metadata?: Record<string, unknown>;
    noops?: string[];
    phases?: CortexDreamReportPhase[];
    status: Exclude<CortexDreamReportStatus, 'running'>;
    summary: string;
    warnings?: string[];
}

export interface AddCortexDreamReportItemInput {
    kind: CortexDreamReportItemKind;
    metadata?: Record<string, unknown>;
    pageId?: string | null;
    pageSlug?: string | null;
    summary: string;
    title: string;
}

interface DreamReportRow {
    completed_at: string | null;
    duration_ms: number | null;
    estimated_cost_usd: number | null;
    health_after_json: string | null;
    health_before_json: string | null;
    id: string;
    model: string | null;
    noops_json: string;
    phases_json: string;
    provider: string | null;
    started_at: string;
    status: CortexDreamReportStatus;
    summary: string;
    warnings_json: string;
}

interface DreamReportItemRow {
    created_at: string;
    id: string;
    kind: CortexDreamReportItemKind;
    metadata_json: string;
    page_id: string | null;
    page_slug: string | null;
    summary: string;
    title: string;
}

export async function startCortexDreamReport(
    db: CortexDatabase,
    input: StartCortexDreamReportInput
): Promise<CortexDreamReport> {
    const startedAt = input.startedAt ?? nowIso();
    const id = createCortexId('ctxdream');
    await db
        .prepare(
            `INSERT INTO cortex_dream_reports
             (id, status, started_at, provider, model, summary, health_before_json, created_at, updated_at)
             VALUES ($id, 'running', $startedAt, $provider, $model, $summary, $healthBeforeJson, $createdAt, $updatedAt)`
        )
        .run({
            createdAt: startedAt,
            healthBeforeJson: input.healthBefore ? JSON.stringify(input.healthBefore) : null,
            id,
            model: input.model,
            provider: input.provider,
            startedAt,
            summary: 'Dream is running.',
            updatedAt: startedAt,
        });
    const report = await getCortexDreamReport(db, id);
    if (!report) {
        throw new Error('Failed to create Cortex Dream report.');
    }
    return report;
}

export async function finishCortexDreamReport(
    db: CortexDatabase,
    id: string,
    input: FinishCortexDreamReportInput
): Promise<CortexDreamReport> {
    const completedAt = input.completedAt ?? nowIso();
    const row = await getDreamReportRow(db, id);
    if (!row) {
        throw new Error(`Cortex Dream report ${id} not found.`);
    }
    const durationMs = Math.max(0, Date.parse(completedAt) - Date.parse(row.started_at));
    await db
        .prepare(
            `UPDATE cortex_dream_reports
             SET status = $status,
                 completed_at = $completedAt,
                 duration_ms = $durationMs,
                 estimated_cost_usd = $estimatedCostUsd,
                 summary = $summary,
                 health_before_json = $healthBeforeJson,
                 health_after_json = $healthAfterJson,
                 warnings_json = $warningsJson,
                 noops_json = $noopsJson,
                 phases_json = $phasesJson,
                 metadata_json = $metadataJson,
                 updated_at = $updatedAt
             WHERE id = $id`
        )
        .run({
            completedAt,
            durationMs,
            estimatedCostUsd: input.estimatedCostUsd ?? null,
            healthAfterJson: input.healthAfter ? JSON.stringify(input.healthAfter) : null,
            healthBeforeJson:
                input.healthBefore === undefined
                    ? row.health_before_json
                    : input.healthBefore
                      ? JSON.stringify(input.healthBefore)
                      : null,
            id,
            metadataJson: JSON.stringify(input.metadata ?? {}),
            noopsJson: JSON.stringify(input.noops ?? []),
            phasesJson: JSON.stringify(input.phases ?? []),
            status: input.status,
            summary: input.summary,
            updatedAt: completedAt,
            warningsJson: JSON.stringify(input.warnings ?? []),
        });
    const report = await getCortexDreamReport(db, id);
    if (!report) {
        throw new Error(`Cortex Dream report ${id} not found after update.`);
    }
    return report;
}

export async function addCortexDreamReportItem(
    db: CortexDatabase,
    reportId: string,
    input: AddCortexDreamReportItemInput
): Promise<CortexDreamReportItem> {
    const id = createCortexId('ctxdreamitem');
    const createdAt = nowIso();
    await db
        .prepare(
            `INSERT INTO cortex_dream_report_items
             (id, report_id, kind, page_id, page_slug, title, summary, metadata_json, created_at)
             VALUES ($id, $reportId, $kind, $pageId, $pageSlug, $title, $summary, $metadataJson, $createdAt)`
        )
        .run({
            createdAt,
            id,
            kind: input.kind,
            metadataJson: JSON.stringify(input.metadata ?? {}),
            pageId: input.pageId ?? null,
            pageSlug: input.pageSlug ?? null,
            reportId,
            summary: input.summary,
            title: input.title,
        });
    return {
        createdAt,
        id,
        kind: input.kind,
        metadata: input.metadata ?? {},
        pageId: input.pageId ?? null,
        pageSlug: input.pageSlug ?? null,
        summary: input.summary,
        title: input.title,
    };
}

export async function listCortexDreamReports(
    db: CortexDatabase,
    limit = 20
): Promise<CortexDreamReport[]> {
    const rows = await db
        .prepare(
            `SELECT id, status, started_at, completed_at, duration_ms, provider, model,
                    estimated_cost_usd, summary, health_before_json, health_after_json,
                    warnings_json, noops_json, phases_json
             FROM cortex_dream_reports
             ORDER BY started_at DESC
             LIMIT $limit`
        )
        .all<DreamReportRow>({ limit: Math.max(1, Math.min(100, Math.floor(limit))) });
    const reports: CortexDreamReport[] = [];
    for (const row of rows) {
        reports.push(await toDreamReport(db, row));
    }
    return reports;
}

export async function getCortexDreamReport(
    db: CortexDatabase,
    id: string
): Promise<CortexDreamReport | null> {
    const row = await getDreamReportRow(db, id);
    return row ? await toDreamReport(db, row) : null;
}

async function getDreamReportRow(db: CortexDatabase, id: string): Promise<DreamReportRow | null> {
    return await db
        .prepare(
            `SELECT id, status, started_at, completed_at, duration_ms, provider, model,
                    estimated_cost_usd, summary, health_before_json, health_after_json,
                    warnings_json, noops_json, phases_json
             FROM cortex_dream_reports
             WHERE id = $id`
        )
        .get<DreamReportRow>({ id });
}

async function toDreamReport(db: CortexDatabase, row: DreamReportRow): Promise<CortexDreamReport> {
    return {
        completedAt: row.completed_at,
        durationMs: row.duration_ms,
        estimatedCostUsd: row.estimated_cost_usd,
        healthAfter: readHealth(row.health_after_json),
        healthBefore: readHealth(row.health_before_json),
        id: row.id,
        items: await listDreamReportItems(db, row.id),
        model: row.model,
        noops: readJsonArray<string>(row.noops_json),
        phases: readJsonArray<CortexDreamReportPhase>(row.phases_json),
        provider: row.provider,
        startedAt: row.started_at,
        status: row.status,
        summary: row.summary,
        warnings: readJsonArray<string>(row.warnings_json),
    };
}

async function listDreamReportItems(
    db: CortexDatabase,
    reportId: string
): Promise<CortexDreamReportItem[]> {
    const rows = await db
        .prepare(
            `SELECT id, kind, page_id, page_slug, title, summary, metadata_json, created_at
             FROM cortex_dream_report_items
             WHERE report_id = $reportId
             ORDER BY created_at ASC`
        )
        .all<DreamReportItemRow>({ reportId });
    return rows.map((row) => ({
        createdAt: row.created_at,
        id: row.id,
        kind: row.kind,
        metadata: readJsonRecord(row.metadata_json),
        pageId: row.page_id,
        pageSlug: row.page_slug,
        summary: row.summary,
        title: row.title,
    }));
}

function readHealth(value: string | null): CortexDreamReportHealth | null {
    if (!value) {
        return null;
    }
    const parsed = readJsonRecord(value);
    const score = Number(parsed.score);
    const issueCount = Number(parsed.issueCount);
    return {
        counts: readHealthCounts(parsed.counts),
        issueCount: Number.isFinite(issueCount) ? Math.max(0, Math.floor(issueCount)) : 0,
        score: Number.isFinite(score) ? Math.max(0, Math.min(100, Math.floor(score))) : 0,
    };
}

function readHealthCounts(value: unknown): Record<string, number> {
    if (!(value && typeof value === 'object' && !Array.isArray(value))) {
        return {};
    }
    return Object.fromEntries(
        Object.entries(value)
            .map(([key, count]) => [key, Number(count)] as const)
            .filter((entry): entry is readonly [string, number] => Number.isFinite(entry[1]))
            .map(([key, count]) => [key, Math.max(0, Math.floor(count))])
    );
}
