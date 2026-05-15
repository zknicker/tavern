import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const agentRuntimeConnectionsTable = sqliteTable('agent_runtime_connections', {
    authJson: text('auth_json'),
    baseUrl: text('base_url').notNull(),
    createdAt: text('created_at').notNull(),
    enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
    id: text('id').primaryKey(),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(false),
    lastCheckedAt: text('last_checked_at'),
    lastError: text('last_error'),
    lastSyncedAt: text('last_synced_at'),
    name: text('name').notNull(),
    updatedAt: text('updated_at').notNull(),
});

export type AgentRuntimeConnectionRecord = typeof agentRuntimeConnectionsTable.$inferSelect;
