import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const tasksTable = sqliteTable(
    'tasks',
    {
        assigneeAgentId: text('assignee_agent_id'),
        assigneeKind: text('assignee_kind'),
        createdAt: text('created_at').notNull(),
        epicId: text('epic_id'),
        id: text('id').primaryKey(),
        kind: text('kind').notNull(),
        lastSyncedAt: text('last_synced_at').notNull(),
        number: integer('number').notNull(),
        priority: text('priority').notNull(),
        rawJson: text('raw_json').notNull(),
        runtimeId: text('runtime_id').notNull(),
        runtimeTaskId: text('runtime_task_id').notNull(),
        status: text('status').notNull(),
        title: text('title').notNull(),
        updatedAt: text('updated_at').notNull(),
    },
    (table) => ({
        lastSyncedAtIdx: index('tasks_last_synced_at_idx').on(table.lastSyncedAt),
        runtimeIdx: index('tasks_runtime_idx').on(table.runtimeId),
        runtimeTaskIdx: uniqueIndex('tasks_runtime_task_idx').on(
            table.runtimeId,
            table.runtimeTaskId
        ),
        statusIdx: index('tasks_status_idx').on(table.status),
    })
);

export type TaskRecord = typeof tasksTable.$inferSelect;
export type TaskInsert = typeof tasksTable.$inferInsert;
