import { index, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const agentThoughtSnapshotsTable = sqliteTable(
    'agent_thought_snapshots',
    {
        id: text('id').primaryKey(),
        agentId: text('agent_id').notNull(),
        generatedAt: text('generated_at').notNull(),
        model: text('model').notNull(),
        previousSnapshotId: text('previous_snapshot_id'),
        promptMarkdown: text('prompt_markdown').notNull(),
        sessionKeysJson: text('session_keys_json').notNull().default('[]'),
        snapshotHour: text('snapshot_hour').notNull(),
        thoughtsMarkdown: text('thoughts_markdown').notNull(),
        windowEndAt: text('window_end_at').notNull(),
        windowStartAt: text('window_start_at').notNull(),
    },
    (table) => ({
        agentIdx: index('agent_thought_snapshots_agent_idx').on(table.agentId),
        generatedAtIdx: index('agent_thought_snapshots_generated_at_idx').on(table.generatedAt),
        snapshotHourIdx: index('agent_thought_snapshots_snapshot_hour_idx').on(table.snapshotHour),
    })
);

export type AgentThoughtSnapshotRecord = typeof agentThoughtSnapshotsTable.$inferSelect;
export type AgentThoughtSnapshotInsert = typeof agentThoughtSnapshotsTable.$inferInsert;
