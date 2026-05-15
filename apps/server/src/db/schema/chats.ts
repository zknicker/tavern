import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const chatsTable = sqliteTable(
    'chats',
    {
        bindingId: text('binding_id'),
        bindingsJson: text('bindings_json').notNull(),
        conversationKind: text('conversation_kind'),
        id: text('id').primaryKey(),
        isArchived: integer('is_archived', { mode: 'boolean' }).notNull().default(false),
        inboundMode: text('inbound_mode').notNull(),
        lastSyncedAt: text('last_synced_at').notNull(),
        metadataJson: text('metadata_json').notNull(),
        parentTarget: text('parent_target'),
        platform: text('platform').notNull(),
        platformMetadataJson: text('platform_metadata_json').notNull(),
        rawJson: text('raw_json').notNull(),
        requiresTrigger: integer('requires_trigger', { mode: 'boolean' }).notNull(),
        runtimeId: text('runtime_id').notNull(),
        scope: text('scope'),
        target: text('target'),
        trigger: text('trigger'),
        updatedAt: text('updated_at').notNull(),
    },
    (table) => ({
        lastSyncedAtIdx: index('chats_last_synced_at_idx').on(table.lastSyncedAt),
        runtimeIdx: index('chats_runtime_idx').on(table.runtimeId),
    })
);

export type ChatRecord = typeof chatsTable.$inferSelect;
export type ChatInsert = typeof chatsTable.$inferInsert;
