import { index, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const participantsTable = sqliteTable(
    'participants',
    {
        accountKey: text('account_key'),
        createdAt: text('created_at').notNull(),
        externalId: text('external_id'),
        id: text('id').primaryKey(),
        lastSeenAt: text('last_seen_at'),
        observedName: text('observed_name').notNull(),
        provider: text('provider').notNull(),
        updatedAt: text('updated_at').notNull(),
    },
    (table) => ({
        observedNameIdx: index('participants_observed_name_idx').on(table.observedName),
        sourceIdx: index('participants_source_idx').on(
            table.provider,
            table.accountKey,
            table.externalId
        ),
    })
);

export const participantLabelsTable = sqliteTable(
    'participant_labels',
    {
        createdAt: text('created_at').notNull(),
        id: text('id').primaryKey(),
        label: text('label').notNull(),
        lastSeenAt: text('last_seen_at').notNull(),
        normalizedLabel: text('normalized_label').notNull(),
        participantId: text('participant_id')
            .notNull()
            .references(() => participantsTable.id, { onDelete: 'cascade' }),
        updatedAt: text('updated_at').notNull(),
    },
    (table) => ({
        normalizedIdx: index('participant_labels_normalized_idx').on(
            table.participantId,
            table.normalizedLabel
        ),
        participantIdx: index('participant_labels_participant_idx').on(table.participantId),
    })
);

export type ParticipantLabelInsert = typeof participantLabelsTable.$inferInsert;
export type ParticipantLabelRecord = typeof participantLabelsTable.$inferSelect;
export type ParticipantInsert = typeof participantsTable.$inferInsert;
export type ParticipantRecord = typeof participantsTable.$inferSelect;
