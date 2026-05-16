import { index, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const chatActiveTurnStepsTable = sqliteTable(
    'chat_active_turn_steps',
    {
        agentId: text('agent_id').notNull(),
        chatId: text('chat_id').notNull(),
        firstObservedAt: text('first_observed_at').notNull(),
        progressStartedAt: text('progress_started_at').notNull(),
        runId: text('run_id').notNull(),
        sessionKey: text('session_key').notNull(),
        startedAt: text('started_at').notNull(),
        stepId: text('step_id').notNull(),
        stepJson: text('step_json').notNull(),
        updatedAt: text('updated_at').notNull(),
    },
    (table) => ({
        pk: primaryKey({ columns: [table.sessionKey, table.runId, table.stepId] }),
        chatIdx: index('chat_active_turn_steps_chat_idx').on(table.chatId),
        sessionKeyIdx: index('chat_active_turn_steps_session_key_idx').on(table.sessionKey),
        turnStepIdx: uniqueIndex('chat_active_turn_steps_turn_step_idx').on(
            table.sessionKey,
            table.runId,
            table.stepId
        ),
    })
);
