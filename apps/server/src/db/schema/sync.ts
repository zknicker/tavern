import { primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const syncStateTable = sqliteTable(
    'sync_state',
    {
        hash: text('hash'),
        id: text('id').notNull(),
        json: text('json'),
        kind: text('kind').notNull(),
        lastAttemptedAt: text('last_attempted_at'),
        lastError: text('last_error'),
        lastSuccessfulAt: text('last_successful_at'),
        agentRuntimeHash: text('runtime_hash'),
        agentRuntimeJson: text('runtime_json'),
        status: text('status').notNull(),
        updatedAt: text('updated_at').notNull(),
    },
    (table) => ({
        pk: primaryKey({
            columns: [table.kind, table.id],
        }),
    })
);
export type SyncStateInsert = typeof syncStateTable.$inferInsert;
export type SyncStateRecord = typeof syncStateTable.$inferSelect;
