import { primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const agentRuntimeCapabilityStatusTable = sqliteTable(
    'agent_runtime_capability_status',
    {
        capability: text('capability').notNull(),
        checkedAt: text('checked_at').notNull(),
        errorCode: text('error_code'),
        lastHealthyAt: text('last_healthy_at'),
        metadataJson: text('metadata_json'),
        method: text('method'),
        reason: text('reason'),
        runtimeId: text('runtime_id').notNull(),
        state: text('state').notNull(),
        technicalMessage: text('technical_message'),
        updatedAt: text('updated_at').notNull(),
    },
    (table) => ({
        pk: primaryKey({
            columns: [table.runtimeId, table.capability],
        }),
    })
);

export type AgentRuntimeCapabilityStatusRecord =
    typeof agentRuntimeCapabilityStatusTable.$inferSelect;
