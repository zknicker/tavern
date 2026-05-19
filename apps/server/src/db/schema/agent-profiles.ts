import { primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const agentProfilesTable = sqliteTable(
    'agent_profiles',
    {
        createdAt: text('created_at').notNull(),
        agentId: text('agent_id').notNull(),
        primaryColor: text('primary_color'),
        runtimeId: text('runtime_id').notNull(),
        soul: text('soul').notNull().default(''),
        updatedAt: text('updated_at').notNull(),
    },
    (table) => ({
        pk: primaryKey({
            columns: [table.runtimeId, table.agentId],
        }),
    })
);

export type AgentProfile = typeof agentProfilesTable.$inferSelect;
