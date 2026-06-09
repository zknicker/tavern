import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const usageSourceSettingsTable = sqliteTable('usage_source_settings', {
    createdAt: text('created_at').notNull(),
    id: text('id').primaryKey(),
    settingsJson: text('settings_json').notNull(),
    updatedAt: text('updated_at').notNull(),
});

export type UsageSourceSettingsRecord = typeof usageSourceSettingsTable.$inferSelect;
