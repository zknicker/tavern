import { index, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const logsTable = sqliteTable(
    'logs',
    {
        id: text('id').primaryKey(),
        level: text('level').notNull(),
        message: text('message').notNull(),
        source: text('source').notNull(),
        syncedAt: text('synced_at').notNull(),
        tagsJson: text('tags_json').notNull(),
        time: text('time').notNull(),
    },
    (table) => ({
        sourceIdx: index('logs_source_idx').on(table.source),
        timeIdx: index('logs_time_idx').on(table.time),
    })
);

export type LogRecord = typeof logsTable.$inferSelect;
export type LogInsert = typeof logsTable.$inferInsert;
