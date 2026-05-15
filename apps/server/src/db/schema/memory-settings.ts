import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const memorySettingsTable = sqliteTable('memory_settings', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => 'primary'),
    settingsJson: text('settings_json').notNull(),
    updatedAt: text('updated_at').notNull(),
});
