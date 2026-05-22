import type { AgentRuntimeCron } from '@tavern/api';
import { and, asc, eq, notInArray } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { cronJobsTable } from '../db/schema.ts';
import { getActiveRuntimeId } from './agent-runtime-connections.ts';

export type CronJobRecord = typeof cronJobsTable.$inferSelect;

export function buildCronJobId(input: { runtimeCronJobId: string }) {
    return input.runtimeCronJobId;
}

export async function listCronJobRecords(options?: {
    includeInactive?: boolean;
    runtimeId?: string;
}) {
    const runtimeId = options?.includeInactive
        ? null
        : (options?.runtimeId ?? (await getActiveRuntimeId()));
    const query = db.select().from(cronJobsTable);
    const scopedQuery = runtimeId ? query.where(eq(cronJobsTable.runtimeId, runtimeId)) : query;

    return await scopedQuery.orderBy(asc(cronJobsTable.name));
}

export async function getCronJobRecord(jobId: string) {
    const [job] = await db.select().from(cronJobsTable).where(eq(cronJobsTable.id, jobId)).limit(1);

    return job ?? null;
}

export async function deleteCronJobRecord(jobId: string) {
    await db.delete(cronJobsTable).where(eq(cronJobsTable.id, jobId));
}

export async function saveCronJobRecord(input: {
    job: AgentRuntimeCron;
    runtimeId: string;
    syncedAt?: string;
}) {
    const timestamp = input.syncedAt ?? new Date().toISOString();
    const id = buildCronJobId({
        runtimeCronJobId: input.job.id,
    });

    await db
        .insert(cronJobsTable)
        .values(toCronJobRow({ ...input, id, timestamp }))
        .onConflictDoUpdate({
            target: cronJobsTable.id,
            set: toCronJobRow({ ...input, id, timestamp }),
        });

    return id;
}

export async function syncCronJobsForRuntime(input: {
    jobs: AgentRuntimeCron[];
    runtimeId: string;
    syncedAt?: string;
}) {
    const timestamp = input.syncedAt ?? new Date().toISOString();
    const syncedIds = input.jobs.map((job) => buildCronJobId({ runtimeCronJobId: job.id }));

    for (const job of input.jobs) {
        await saveCronJobRecord({
            job,
            runtimeId: input.runtimeId,
            syncedAt: timestamp,
        });
    }

    const staleRows =
        syncedIds.length > 0
            ? await db
                  .delete(cronJobsTable)
                  .where(
                      and(
                          eq(cronJobsTable.runtimeId, input.runtimeId),
                          notInArray(cronJobsTable.id, syncedIds)
                      )
                  )
                  .returning({ id: cronJobsTable.id })
            : await db
                  .delete(cronJobsTable)
                  .where(eq(cronJobsTable.runtimeId, input.runtimeId))
                  .returning({ id: cronJobsTable.id });

    return {
        deleted: staleRows.length,
        synced: syncedIds.length,
    };
}

export function parseCronJobRawJson(job: CronJobRecord) {
    return JSON.parse(job.rawJson) as AgentRuntimeCron;
}

function toCronJobRow(input: {
    id: string;
    job: AgentRuntimeCron;
    runtimeId: string;
    timestamp: string;
}) {
    return {
        agentId: input.job.agentId,
        createdAt: input.job.createdAt,
        deleteAfterRun: input.job.deleteAfterRun,
        deliveryJson: input.job.delivery ? JSON.stringify(input.job.delivery) : null,
        description: input.job.description,
        enabled: input.job.enabled,
        id: input.id,
        lastSyncedAt: input.timestamp,
        name: input.job.name,
        payloadJson: JSON.stringify(input.job.payload),
        rawJson: JSON.stringify(input.job),
        runtimeCronJobId: input.job.id,
        runtimeId: input.runtimeId,
        scheduleJson: JSON.stringify(input.job.schedule),
        stateJson: JSON.stringify(input.job.state),
        updatedAt: input.job.updatedAt,
        wakeMode: input.job.wakeMode,
    };
}
