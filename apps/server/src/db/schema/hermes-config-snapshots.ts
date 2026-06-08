import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const hermesConfigSnapshotsTable = sqliteTable('hermes_config_snapshots', {
    configJson: text('config_json').notNull(),
    hash: text('hash').notNull(),
    issuesJson: text('issues_json').notNull(),
    lastError: text('last_error'),
    lastSyncedAt: text('last_synced_at').notNull(),
    raw: text('raw').notNull(),
    runtimeId: text('runtime_id').primaryKey(),
    updatedAt: text('updated_at').notNull(),
    valid: text('valid').notNull(),
});

export type HermesConfigSnapshotRecord = typeof hermesConfigSnapshotsTable.$inferSelect;
