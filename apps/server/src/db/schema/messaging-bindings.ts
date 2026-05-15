import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const messagingBindingsTable = sqliteTable('messaging_bindings', {
    agentId: text('agent_id').notNull(),
    createdAt: text('created_at').notNull(),
    enabled: text('enabled').notNull(),
    id: text('id').primaryKey(),
    inboundMode: text('inbound_mode').notNull(),
    matchJson: text('match_json').notNull(),
    metadataJson: text('metadata_json').notNull(),
    name: text('name').notNull(),
    platform: text('platform').notNull(),
    token: text('token').notNull(),
    updatedAt: text('updated_at').notNull(),
});

export type MessagingBindingRecord = typeof messagingBindingsTable.$inferSelect;
