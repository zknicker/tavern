import { index, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const skillsTable = sqliteTable(
    'skills',
    {
        id: text('id').notNull(),
        lastSyncedAt: text('last_synced_at').notNull(),
        runtimeId: text('runtime_id').notNull(),
        summaryJson: text('summary_json').notNull(),
        updatedAt: text('updated_at').notNull(),
    },
    (table) => ({
        pk: primaryKey({
            columns: [table.runtimeId, table.id],
        }),
        runtimeIdx: index('skills_runtime_idx').on(table.runtimeId),
    })
);

export type SkillRecord = typeof skillsTable.$inferSelect;
