import { and, desc, eq, sql } from 'drizzle-orm';
import { cronRunSchema } from '../cron/contracts.ts';
import { db } from '../db/index.ts';
import { type CronRunInsert, cronRunsTable } from '../db/schema.ts';
import { getActiveRuntimeId } from './agent-runtime-connections.ts';

function mapCronRunRecord(record: typeof cronRunsTable.$inferSelect) {
    return cronRunSchema.parse(record);
}

export async function listCronRuns(input?: {
    includeInactive?: boolean;
    jobId?: string;
    runtimeId?: string;
}) {
    const runtimeId = input?.includeInactive
        ? null
        : (input?.runtimeId ?? (await getActiveRuntimeId()));
    const baseQuery = db.select().from(cronRunsTable);
    const filters = [
        input?.jobId ? eq(cronRunsTable.jobId, input.jobId) : null,
        runtimeId ? eq(cronRunsTable.runtimeId, runtimeId) : null,
    ].filter((filter): filter is NonNullable<typeof filter> => filter !== null);
    const query = filters.length > 0 ? baseQuery.where(and(...filters)) : baseQuery;
    const records = await query.orderBy(desc(cronRunsTable.scheduledFor), desc(cronRunsTable.id));

    return records.map(mapCronRunRecord);
}

export async function getCronRun(id: string) {
    const [record] = await db.select().from(cronRunsTable).where(eq(cronRunsTable.id, id)).limit(1);

    return record ? mapCronRunRecord(record) : null;
}

export async function getLatestCronRun(jobId: string) {
    const [record] = await db
        .select()
        .from(cronRunsTable)
        .where(eq(cronRunsTable.jobId, jobId))
        .orderBy(desc(cronRunsTable.scheduledFor), desc(cronRunsTable.id))
        .limit(1);

    return record ? mapCronRunRecord(record) : null;
}

export async function upsertCronRuns(records: CronRunInsert[]) {
    if (records.length === 0) {
        return;
    }

    await db
        .insert(cronRunsTable)
        .values(records)
        .onConflictDoUpdate({
            target: cronRunsTable.id,
            set: {
                chatId: sqlExcluded('chatId'),
                executionErrorCode: sqlExcluded('executionErrorCode'),
                executionErrorMessage: sqlExcluded('executionErrorMessage'),
                finishedAt: sqlExcluded('finishedAt'),
                jobId: sqlExcluded('jobId'),
                quiet: sqlExcluded('quiet'),
                runtimeId: sqlExcluded('runtimeId'),
                scheduledFor: sqlExcluded('scheduledFor'),
                scriptExitCode: sqlExcluded('scriptExitCode'),
                scriptStderr: sqlExcluded('scriptStderr'),
                startedAt: sqlExcluded('startedAt'),
                status: sqlExcluded('status'),
                syncedAt: sqlExcluded('syncedAt'),
                trigger: sqlExcluded('trigger'),
                turnId: sqlExcluded('turnId'),
            },
        });
}

function sqlExcluded<TKey extends keyof CronRunInsert>(column: TKey) {
    const columnNameByKey: Record<keyof CronRunInsert, string> = {
        chatId: 'chat_id',
        executionErrorCode: 'execution_error_code',
        executionErrorMessage: 'execution_error_message',
        finishedAt: 'finished_at',
        id: 'id',
        jobId: 'job_id',
        quiet: 'quiet',
        runtimeId: 'runtime_id',
        scheduledFor: 'scheduled_for',
        scriptExitCode: 'script_exit_code',
        scriptStderr: 'script_stderr',
        startedAt: 'started_at',
        status: 'status',
        syncedAt: 'synced_at',
        trigger: 'trigger',
        turnId: 'turn_id',
    };

    return sql.raw(`excluded.${columnNameByKey[column]}`);
}
