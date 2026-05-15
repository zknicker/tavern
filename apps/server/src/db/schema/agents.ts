import { index, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const agentsTable = sqliteTable(
    'agents',
    {
        avatar: text('avatar'),
        createdAt: text('created_at').notNull(),
        emoji: text('emoji'),
        enabledSkillIdsJson: text('enabled_skill_ids_json').notNull(),
        id: text('id').primaryKey(),
        lastSyncedAt: text('last_synced_at').notNull(),
        name: text('name').notNull(),
        primaryColor: text('primary_color'),
        rawJson: text('raw_json').notNull(),
        runtimeId: text('runtime_id').notNull(),
        updatedAt: text('updated_at').notNull(),
        workspaceFolder: text('workspace_folder'),
    },
    (table) => ({
        lastSyncedAtIdx: index('agents_last_synced_at_idx').on(table.lastSyncedAt),
        runtimeIdx: index('agents_runtime_idx').on(table.runtimeId),
    })
);

export type AgentRecord = typeof agentsTable.$inferSelect;
