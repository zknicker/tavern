import {
    agentRuntimeMutationHeaders,
    agentRuntimeMutationOrigins,
    agentRuntimeRoutes,
    type MemoryJobKind,
    type MemoryJobStatus,
    memoryDreamRequestSchema,
    memoryDreamResultSchema,
    memoryJobDetailSchema,
    memoryJobListSchema,
} from '@tavern/api';
import { getDb } from '../db/connection.ts';
import { namedParams } from '../db/sqlite.ts';
import { conflict, forbidden, json, notFound } from '../tavern/http.ts';
import { processQueuedMemoryDreams, queueMemoryDream } from './dreaming.ts';
import { isMemoryEnabled } from './settings.ts';
import { listMemoryWorkers } from './worker-status.ts';

interface MemoryJobRow {
    agent_id: string;
    agent_participant_id: string | null;
    chat_id: string | null;
    completed_at: string | null;
    created_at: string;
    error: string | null;
    file_changes_json: string;
    id: string;
    kind: string;
    metadata_json: string;
    model_category: string | null;
    model_json: string | null;
    output_path: string | null;
    source_end_sequence: number | null;
    source_start_sequence: number | null;
    status: string;
    transcript_json: string;
    updated_at: string;
    usage_json: string;
}

export async function handleMemoryRequest(request: Request): Promise<Response | null> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/memory')) {
        return null;
    }

    if (request.method === 'GET' && url.pathname === agentRuntimeRoutes.memoryJobs) {
        return json(memoryJobListSchema.parse({ jobs: listMemoryJobs(url) }));
    }

    if (request.method === 'GET' && url.pathname === agentRuntimeRoutes.memoryWorkers) {
        return json(listMemoryWorkers());
    }

    const jobMatch = url.pathname.match(/^\/memory\/jobs\/([^/]+)$/u);
    if (request.method === 'GET' && jobMatch?.[1]) {
        const job = getMemoryJob(decodeURIComponent(jobMatch[1]));
        return job ? json(memoryJobDetailSchema.parse(job)) : notFound();
    }

    const dreamMatch = url.pathname.match(/^\/memory\/agents\/([^/]+)\/dream$/u);
    if (request.method === 'POST' && dreamMatch?.[1]) {
        const forbiddenResponse = requireTavernMutation(request, 'Memory dreaming');
        if (forbiddenResponse) {
            return forbiddenResponse;
        }
        if (!isMemoryEnabled()) {
            return conflict('Memory dreaming unavailable while Memory is off.');
        }
        const input = memoryDreamRequestSchema.parse({
            agentId: decodeURIComponent(dreamMatch[1]),
            ...(await readJsonRecord(request)),
        });
        const jobId = queueMemoryDream({ agentId: input.agentId, explicit: true });
        void processQueuedMemoryDreams().catch(() => {});
        const job = getMemoryJob(jobId);
        if (!job) {
            return notFound();
        }
        return json(memoryDreamResultSchema.parse({ job }), 202);
    }

    return null;
}

function listMemoryJobs(url: URL) {
    const agentId = url.searchParams.get('agentId')?.trim() || null;
    const limit = Math.max(1, Math.min(Number(url.searchParams.get('limit') ?? 50), 200));
    const filters = buildMemoryJobFilters(url);
    const rows = getDb()
        .prepare(
            `SELECT *
             FROM memory_jobs
             WHERE ($agentId IS NULL OR agent_id = $agentId)
               ${filters.sql}
             ORDER BY created_at DESC
             LIMIT $limit`
        )
        .all(namedParams({ agentId, limit, ...filters.params })) as MemoryJobRow[];
    return rows.map(toMemoryJobSummary);
}

function buildMemoryJobFilters(url: URL) {
    const conditions: string[] = [];
    const params: Record<string, number | string> = {};
    addCsvFilter({
        column: 'kind',
        conditions,
        key: 'kind',
        params,
        validValues: ['curation', 'dream', 'extraction', 'skill_review'] satisfies MemoryJobKind[],
        value: url.searchParams.get('kind'),
    });
    addCsvFilter({
        column: 'status',
        conditions,
        key: 'status',
        params,
        validValues: [
            'completed',
            'failed',
            'queued',
            'running',
            'skipped',
        ] satisfies MemoryJobStatus[],
        value: url.searchParams.get('status'),
    });

    const sinceDays = Number(url.searchParams.get('sinceDays'));
    if (Number.isFinite(sinceDays) && sinceDays > 0) {
        params.sinceCreatedAt = new Date(
            Date.now() - sinceDays * 24 * 60 * 60 * 1000
        ).toISOString();
        conditions.push('created_at >= $sinceCreatedAt');
    }

    return {
        params,
        sql: conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : '',
    };
}

function addCsvFilter<T extends string>(input: {
    column: string;
    conditions: string[];
    key: string;
    params: Record<string, number | string>;
    validValues: readonly T[];
    value: null | string;
}) {
    if (input.value === null) {
        return;
    }
    const values = input.value
        .split(',')
        .map((value) => value.trim())
        .filter((value): value is T => (input.validValues as readonly string[]).includes(value));
    if (values.length === 0) {
        input.conditions.push('0 = 1');
        return;
    }
    const placeholders = values.map((value, index) => {
        const paramKey = `${input.key}${index}`;
        input.params[paramKey] = value;
        return `$${paramKey}`;
    });
    input.conditions.push(`${input.column} IN (${placeholders.join(', ')})`);
}

function getMemoryJob(id: string) {
    const row = getDb()
        .prepare('SELECT * FROM memory_jobs WHERE id = $id')
        .get(namedParams({ id })) as MemoryJobRow | undefined;
    return row ? toMemoryJobDetail(row) : null;
}

function toMemoryJobSummary(row: MemoryJobRow) {
    return {
        agentId: row.agent_id,
        agentParticipantId: row.agent_participant_id,
        chatId: row.chat_id,
        completedAt: row.completed_at,
        createdAt: row.created_at,
        error: row.error,
        fileChangeCount: parseJsonArray(row.file_changes_json).length,
        id: row.id,
        kind: row.kind,
        modelCategory: row.model_category,
        outputPath: row.output_path,
        sourceEndSequence: row.source_end_sequence,
        sourceStartSequence: row.source_start_sequence,
        status: row.status,
        updatedAt: row.updated_at,
    };
}

function toMemoryJobDetail(row: MemoryJobRow) {
    return {
        ...toMemoryJobSummary(row),
        fileChanges: parseJsonArray(row.file_changes_json),
        metadata: parseJsonRecord(row.metadata_json),
        model: row.model_json ? parseJson(row.model_json) : null,
        transcript: parseJson(row.transcript_json),
        usage: parseJson(row.usage_json),
    };
}

function parseJson(value: string) {
    return JSON.parse(value);
}

function parseJsonArray(value: string) {
    const parsed = parseJson(value);
    return Array.isArray(parsed) ? parsed : [];
}

function parseJsonRecord(value: string) {
    const parsed = parseJson(value);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
    }
    return {};
}

async function readJsonRecord(request: Request): Promise<Record<string, unknown>> {
    const value = await request.json().catch(() => ({}));
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        return value as Record<string, unknown>;
    }
    return {};
}

function requireTavernMutation(request: Request, label: string) {
    if (
        request.headers.get(agentRuntimeMutationHeaders.origin) ===
        agentRuntimeMutationOrigins.tavern
    ) {
        return null;
    }
    return forbidden(`${label} requires a Tavern caller.`);
}
