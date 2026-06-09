import { and, desc, eq, or, sql } from 'drizzle-orm';
import { cronRunSchema } from '../cron/contracts.ts';
import { databaseClient, db } from '../db/index.ts';
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
    const records = await query.orderBy(desc(cronRunsTable.runAt), desc(cronRunsTable.sessionKey));

    return records.map(mapCronRunRecord);
}

export async function getCronRun(id: string) {
    const [record] = await db
        .select()
        .from(cronRunsTable)
        .where(or(eq(cronRunsTable.sessionId, id), eq(cronRunsTable.sessionKey, id)))
        .limit(1);

    return record ? mapCronRunRecord(record) : null;
}

export async function getLatestCronRun(jobId: string) {
    const [record] = await db
        .select()
        .from(cronRunsTable)
        .where(eq(cronRunsTable.jobId, jobId))
        .orderBy(desc(cronRunsTable.runAt), desc(cronRunsTable.sessionKey))
        .limit(1);

    return record ? mapCronRunRecord(record) : null;
}

export async function getLatestCronRunByProviderJobId(providerJobId: string) {
    const [record] = await db
        .select()
        .from(cronRunsTable)
        .where(eq(cronRunsTable.providerJobId, providerJobId))
        .orderBy(desc(cronRunsTable.runAt), desc(cronRunsTable.sessionKey))
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
            target: cronRunsTable.sessionKey,
            set: {
                agentId: sqlExcluded('agentId'),
                deliveryStatus: sqlExcluded('deliveryStatus'),
                durationMs: sqlExcluded('durationMs'),
                error: sqlExcluded('error'),
                jobId: sqlExcluded('jobId'),
                providerJobId: sqlExcluded('providerJobId'),
                runAt: sql`CASE
                    WHEN excluded.trigger = 'manual' THEN ${cronRunsTable.runAt}
                    ELSE excluded.run_at
                END`,
                runtimeId: sqlExcluded('runtimeId'),
                runtimeRunId: sql`CASE
                    WHEN excluded.trigger = 'manual' THEN ${cronRunsTable.runtimeRunId}
                    ELSE excluded.runtime_run_id
                END`,
                runtimeSessionKey: sqlExcluded('runtimeSessionKey'),
                sessionId: sqlExcluded('sessionId'),
                status: sqlExcluded('status'),
                summary: sqlExcluded('summary'),
                syncedAt: sqlExcluded('syncedAt'),
                trigger: sqlExcluded('trigger'),
            },
        });
}

export async function reconcileSyntheticCronTriggerRuns(input: {
    runtimeId: string;
    staleBefore: string;
    syncedAt: string;
}) {
    const deleted = databaseClient
        .prepare(
            `DELETE FROM cron_runs AS manual
             WHERE manual.runtime_id = $runtimeId
               AND manual.trigger = 'manual'
               AND manual.session_key LIKE 'trigger_%'
               AND EXISTS (
                 SELECT 1
                 FROM cron_runs AS actual
                 WHERE actual.runtime_id = manual.runtime_id
                   AND actual.job_id = manual.job_id
                   AND actual.trigger != 'manual'
                   AND actual.session_key NOT LIKE 'trigger_%'
                   AND actual.run_at >= manual.run_at
               )`
        )
        .run({ $runtimeId: input.runtimeId });

    const failed = databaseClient
        .prepare(
            `UPDATE cron_runs AS manual
             SET status = 'error',
                 delivery_status = CASE
                   WHEN manual.delivery_status = 'pending' THEN 'failed'
                   ELSE manual.delivery_status
                 END,
                 error = COALESCE(manual.error, 'Hermes accepted the manual trigger, but no execution appeared.'),
                 summary = 'Hermes accepted the manual trigger, but no execution appeared.',
                 synced_at = $syncedAt
             WHERE manual.runtime_id = $runtimeId
               AND manual.trigger = 'manual'
               AND manual.session_key LIKE 'trigger_%'
               AND manual.status IN ('queued', 'running')
               AND manual.run_at < $staleBefore
               AND NOT EXISTS (
                 SELECT 1
                 FROM cron_runs AS actual
                 WHERE actual.runtime_id = manual.runtime_id
                   AND actual.job_id = manual.job_id
                   AND actual.trigger != 'manual'
                   AND actual.session_key NOT LIKE 'trigger_%'
                   AND actual.run_at >= manual.run_at
               )`
        )
        .run({
            $runtimeId: input.runtimeId,
            $staleBefore: input.staleBefore,
            $syncedAt: input.syncedAt,
        });

    return {
        deleted: deleted.changes,
        failed: failed.changes,
    };
}

function sqlExcluded<TKey extends keyof CronRunInsert>(column: TKey) {
    const columnNameByKey: Record<keyof CronRunInsert, string> = {
        agentId: 'agent_id',
        deliveryStatus: 'delivery_status',
        durationMs: 'duration_ms',
        error: 'error',
        jobId: 'job_id',
        providerJobId: 'provider_job_id',
        runAt: 'run_at',
        runtimeId: 'runtime_id',
        runtimeRunId: 'runtime_run_id',
        runtimeSessionKey: 'runtime_session_key',
        sessionId: 'session_id',
        sessionKey: 'session_key',
        status: 'status',
        summary: 'summary',
        syncedAt: 'synced_at',
        trigger: 'trigger',
    };

    return sql.raw(`excluded.${columnNameByKey[column]}`);
}
