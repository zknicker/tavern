import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const cachedDocumentsTable = sqliteTable('cached_documents', {
    dataJson: text('data_json').notNull(),
    id: text('id').primaryKey(),
    updatedAt: text('updated_at').notNull(),
});

export type CachedDocumentRecord = typeof cachedDocumentsTable.$inferSelect;
