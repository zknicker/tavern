import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const cronJobsTable = sqliteTable(
    'cron_jobs',
    {
        agentId: text('agent_id'),
        createdAt: text('created_at').notNull(),
        deleteAfterRun: integer('delete_after_run', { mode: 'boolean' }).notNull(),
        deliveryJson: text('delivery_json'),
        description: text('description'),
        enabled: integer('enabled', { mode: 'boolean' }).notNull(),
        id: text('id').primaryKey(),
        lastSyncedAt: text('last_synced_at').notNull(),
        name: text('name').notNull(),
        payloadJson: text('payload_json').notNull(),
        rawJson: text('raw_json').notNull(),
        runtimeCronJobId: text('runtime_cron_job_id').notNull(),
        runtimeId: text('runtime_id').notNull(),
        scheduleJson: text('schedule_json').notNull(),
        stateJson: text('state_json').notNull(),
        updatedAt: text('updated_at').notNull(),
        wakeMode: text('wake_mode').notNull(),
    },
    (table) => ({
        agentIdIdx: index('cron_jobs_agent_id_idx').on(table.agentId),
        lastSyncedAtIdx: index('cron_jobs_last_synced_at_idx').on(table.lastSyncedAt),
        runtimeCronJobIdx: uniqueIndex('cron_jobs_runtime_cron_job_idx').on(
            table.runtimeId,
            table.runtimeCronJobId
        ),
        runtimeIdx: index('cron_jobs_runtime_idx').on(table.runtimeId),
    })
);

export const cronRunsTable = sqliteTable(
    'cron_runs',
    {
        agentId: text('agent_id'),
        deliveryStatus: text('delivery_status'),
        durationMs: integer('duration_ms'),
        error: text('error'),
        jobId: text('job_id').notNull(),
        providerJobId: text('provider_job_id'),
        runAt: text('run_at').notNull(),
        runtimeId: text('runtime_id'),
        runtimeRunId: text('runtime_run_id'),
        runtimeSessionKey: text('runtime_session_key'),
        sessionId: text('session_id').notNull(),
        sessionKey: text('session_key').primaryKey(),
        status: text('status'),
        summary: text('summary'),
        syncedAt: text('synced_at').notNull(),
        trigger: text('trigger').notNull().default('schedule'),
    },
    (table) => ({
        jobIdRunAtIdx: index('cron_runs_job_id_run_at_idx').on(table.jobId, table.runAt),
        providerJobIdRunAtIdx: index('cron_runs_provider_job_id_run_at_idx').on(
            table.providerJobId,
            table.runAt
        ),
        runAtIdx: index('cron_runs_run_at_idx').on(table.runAt),
        sessionIdIdx: index('cron_runs_session_id_idx').on(table.sessionId),
    })
);

export type CronJobRecord = typeof cronJobsTable.$inferSelect;
export type CronJobInsert = typeof cronJobsTable.$inferInsert;
export type CronRunRecord = typeof cronRunsTable.$inferSelect;
export type CronRunInsert = typeof cronRunsTable.$inferInsert;
