import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const cronJobsTable = sqliteTable(
    'cron_jobs',
    {
        agentId: text('agent_id').notNull(),
        createdAt: text('created_at').notNull(),
        deleteAfterRun: integer('delete_after_run', { mode: 'boolean' }).notNull(),
        deliveryJson: text('delivery_json').notNull(),
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
        chatId: text('chat_id'),
        executionErrorCode: text('execution_error_code'),
        executionErrorMessage: text('execution_error_message'),
        finishedAt: text('finished_at'),
        id: text('id').primaryKey(),
        jobId: text('job_id').notNull(),
        runtimeId: text('runtime_id'),
        scheduledFor: text('scheduled_for').notNull(),
        startedAt: text('started_at'),
        status: text('status').notNull(),
        syncedAt: text('synced_at').notNull(),
        trigger: text('trigger').notNull().default('schedule'),
        turnId: text('turn_id'),
    },
    (table) => ({
        chatIdIdx: index('cron_runs_chat_id_idx').on(table.chatId),
        jobIdScheduledForIdx: index('cron_runs_job_id_scheduled_for_idx').on(
            table.jobId,
            table.scheduledFor
        ),
        scheduledForIdx: index('cron_runs_scheduled_for_idx').on(table.scheduledFor),
        turnIdIdx: index('cron_runs_turn_id_idx').on(table.turnId),
    })
);

export type CronJobRecord = typeof cronJobsTable.$inferSelect;
export type CronJobInsert = typeof cronJobsTable.$inferInsert;
export type CronRunRecord = typeof cronRunsTable.$inferSelect;
export type CronRunInsert = typeof cronRunsTable.$inferInsert;
