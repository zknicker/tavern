import { and, desc, eq, gte } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { type JobExecutionRecord as JobExecution, jobExecutionsTable } from '../db/schema.ts';

export type { JobExecution };

type JobExecutionState = 'active' | 'completed' | 'delayed' | 'failed' | 'unknown' | 'waiting';

interface JobExecutionStateInput {
    attemptsMade: number;
    createdAt: string;
    error: string | null;
    finishedAt: string | null;
    id: string;
    jobDisplayName: string;
    jobSlug: string;
    progress: number;
    startedAt: string | null;
    state: JobExecutionState;
    updatedAt: string;
}

interface SaveJobExecutionInput extends JobExecutionStateInput {
    logs: string[];
}

function parseLogsJson(logsJson: string) {
    try {
        const parsed = JSON.parse(logsJson);
        return Array.isArray(parsed) ? parsed.filter((entry) => typeof entry === 'string') : [];
    } catch {
        return [];
    }
}

export async function getJobExecution(id: string) {
    const [record] = await db
        .select()
        .from(jobExecutionsTable)
        .where(eq(jobExecutionsTable.id, id))
        .limit(1);

    return record ?? null;
}

export async function getLatestJobExecution(jobSlug: string) {
    const [record] = await db
        .select()
        .from(jobExecutionsTable)
        .where(eq(jobExecutionsTable.jobSlug, jobSlug))
        .orderBy(desc(jobExecutionsTable.createdAt))
        .limit(1);

    return record ?? null;
}

export async function saveJobExecution(input: SaveJobExecutionInput) {
    await db
        .insert(jobExecutionsTable)
        .values({
            attemptsMade: input.attemptsMade,
            createdAt: input.createdAt,
            error: input.error,
            finishedAt: input.finishedAt,
            id: input.id,
            jobDisplayName: input.jobDisplayName,
            jobSlug: input.jobSlug,
            logsJson: JSON.stringify(input.logs),
            progress: input.progress,
            startedAt: input.startedAt,
            state: input.state,
            updatedAt: input.updatedAt,
        })
        .onConflictDoUpdate({
            target: jobExecutionsTable.id,
            set: {
                attemptsMade: input.attemptsMade,
                createdAt: input.createdAt,
                error: input.error,
                finishedAt: input.finishedAt,
                jobDisplayName: input.jobDisplayName,
                jobSlug: input.jobSlug,
                logsJson: JSON.stringify(input.logs),
                progress: input.progress,
                startedAt: input.startedAt,
                state: input.state,
                updatedAt: input.updatedAt,
            },
        });
}

export async function upsertJobExecutionState(input: JobExecutionStateInput) {
    await db
        .insert(jobExecutionsTable)
        .values({
            attemptsMade: input.attemptsMade,
            createdAt: input.createdAt,
            error: input.error,
            finishedAt: input.finishedAt,
            id: input.id,
            jobDisplayName: input.jobDisplayName,
            jobSlug: input.jobSlug,
            logsJson: '[]',
            progress: input.progress,
            startedAt: input.startedAt,
            state: input.state,
            updatedAt: input.updatedAt,
        })
        .onConflictDoUpdate({
            target: jobExecutionsTable.id,
            set: {
                attemptsMade: input.attemptsMade,
                createdAt: input.createdAt,
                error: input.error,
                finishedAt: input.finishedAt,
                jobDisplayName: input.jobDisplayName,
                jobSlug: input.jobSlug,
                progress: input.progress,
                startedAt: input.startedAt,
                state: input.state,
                updatedAt: input.updatedAt,
            },
        });
}

export async function appendJobExecutionLog(input: {
    createdAt: string;
    id: string;
    jobDisplayName: string;
    jobSlug: string;
    message: string;
    startedAt: string | null;
    updatedAt: string;
}) {
    const existing = await getJobExecution(input.id);

    if (!existing) {
        await saveJobExecution({
            attemptsMade: 0,
            createdAt: input.createdAt,
            error: null,
            finishedAt: null,
            id: input.id,
            jobDisplayName: input.jobDisplayName,
            jobSlug: input.jobSlug,
            logs: [input.message],
            progress: 0,
            startedAt: input.startedAt,
            state: 'active',
            updatedAt: input.updatedAt,
        });
        return;
    }

    const logs = parseLogsJson(existing.logsJson);
    logs.push(input.message);

    await db
        .update(jobExecutionsTable)
        .set({
            logsJson: JSON.stringify(logs),
            updatedAt: input.updatedAt,
        })
        .where(eq(jobExecutionsTable.id, input.id));
}

export function listRecentJobExecutions(input: { jobSlug?: string; since: string }) {
    const filters = [gte(jobExecutionsTable.createdAt, input.since)];

    if (input.jobSlug) {
        filters.push(eq(jobExecutionsTable.jobSlug, input.jobSlug));
    }

    return db
        .select()
        .from(jobExecutionsTable)
        .where(and(...filters))
        .orderBy(desc(jobExecutionsTable.createdAt));
}

export function getJobExecutionLogs(record: Pick<JobExecution, 'logsJson'>) {
    return parseLogsJson(record.logsJson);
}
