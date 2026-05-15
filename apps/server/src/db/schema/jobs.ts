import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const jobExecutionsTable = sqliteTable(
    'job_executions',
    {
        attemptsMade: integer('attempts_made').notNull().default(0),
        createdAt: text('created_at').notNull(),
        error: text('error'),
        finishedAt: text('finished_at'),
        id: text('id').primaryKey(),
        jobDisplayName: text('job_display_name').notNull(),
        jobSlug: text('job_slug').notNull(),
        logsJson: text('logs_json').notNull().default('[]'),
        progress: integer('progress').notNull().default(0),
        startedAt: text('started_at'),
        state: text('state').notNull(),
        updatedAt: text('updated_at').notNull(),
    },
    (table) => ({
        createdAtIdx: index('job_executions_created_at_idx').on(table.createdAt),
        jobSlugCreatedAtIdx: index('job_executions_job_slug_created_at_idx').on(
            table.jobSlug,
            table.createdAt
        ),
        stateCreatedAtIdx: index('job_executions_state_created_at_idx').on(
            table.state,
            table.createdAt
        ),
    })
);

export type JobExecutionRecord = typeof jobExecutionsTable.$inferSelect;
