import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const claudeCodeUsageTable = sqliteTable('claude_code_usage', {
    capturedAt: text('captured_at').notNull(),
    createdAt: text('created_at').notNull(),
    id: text('id')
        .primaryKey()
        .$defaultFn(() => 'primary'),
    snapshotJson: text('snapshot_json').notNull(),
    updatedAt: text('updated_at').notNull(),
});

export const codexUsageTable = sqliteTable('codex_usage', {
    capturedAt: text('captured_at').notNull(),
    createdAt: text('created_at').notNull(),
    id: text('id')
        .primaryKey()
        .$defaultFn(() => 'primary'),
    snapshotJson: text('snapshot_json').notNull(),
    updatedAt: text('updated_at').notNull(),
});

export const openRouterUsageTable = sqliteTable('openrouter_usage', {
    capturedAt: text('captured_at').notNull(),
    createdAt: text('created_at').notNull(),
    id: text('id')
        .primaryKey()
        .$defaultFn(() => 'primary'),
    overviewJson: text('overview_json').notNull(),
    updatedAt: text('updated_at').notNull(),
});

export type ClaudeCodeUsageRecord = typeof claudeCodeUsageTable.$inferSelect;
export type CodexUsageRecord = typeof codexUsageTable.$inferSelect;
export type OpenRouterUsageRecord = typeof openRouterUsageTable.$inferSelect;
