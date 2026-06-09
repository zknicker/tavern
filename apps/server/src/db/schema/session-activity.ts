import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const sessionRunsTable = sqliteTable(
    'session_runs',
    {
        id: text('id').primaryKey(),
        sessionKey: text('session_key').notNull(),
        sessionId: text('session_id').notNull(),
        agentId: text('agent_id'),
        parentSessionKey: text('parent_session_key'),
        spawnedBy: text('spawned_by'),
        runtime: text('runtime'),
        mode: text('mode'),
        status: text('status'),
        label: text('label'),
        thinkingLevel: text('thinking_level'),
        deliveryContextJson: text('delivery_context_json'),
        spawnedByMessageId: text('spawned_by_message_id'),
        spawnedByToolCallId: text('spawned_by_tool_call_id'),
        startedAt: text('started_at'),
        finishedAt: text('finished_at'),
        updatedAt: text('updated_at').notNull(),
        payloadJson: text('payload_json').notNull(),
    },
    (table) => ({
        sessionKeyIdx: index('session_runs_session_key_idx').on(table.sessionKey),
        parentSessionKeyIdx: index('session_runs_parent_session_key_idx').on(
            table.parentSessionKey
        ),
        startedAtIdx: index('session_runs_started_at_idx').on(table.startedAt),
        statusIdx: index('session_runs_status_idx').on(table.status),
    })
);

export const sessionMessagesTable = sqliteTable(
    'session_messages',
    {
        id: text('id').primaryKey(),
        sessionKey: text('session_key').notNull(),
        externalMessageId: text('external_message_id'),
        seq: integer('seq'),
        role: text('role').notNull(),
        senderLabel: text('sender_label'),
        actorKind: text('actor_kind'),
        actorId: text('actor_id'),
        errorMessage: text('error_message'),
        contentText: text('content_text'),
        contentJson: text('content_json'),
        api: text('api'),
        provider: text('provider'),
        model: text('model'),
        canonicalModelId: text('canonical_model_id'),
        hermesApi: text('hermes_api'),
        hermesModel: text('hermes_model'),
        hermesModelNameId: text('hermes_model_name_id'),
        hermesProvider: text('hermes_provider'),
        stopReason: text('stop_reason'),
        usageJson: text('usage_json'),
        timestamp: text('timestamp'),
        rawJson: text('raw_json').notNull(),
        syncedAt: text('synced_at').notNull(),
    },
    (table) => ({
        actorIdx: index('session_messages_actor_idx').on(table.actorKind, table.actorId),
        sessionKeyIdx: index('session_messages_session_key_idx').on(table.sessionKey),
        sessionSeqIdx: index('session_messages_session_seq_idx').on(table.sessionKey, table.seq),
        sessionTimestampIdx: index('session_messages_session_timestamp_idx').on(
            table.sessionKey,
            table.timestamp
        ),
    })
);

export const sessionMessagePartsTable = sqliteTable(
    'session_message_parts',
    {
        id: text('id').primaryKey(),
        sessionKey: text('session_key').notNull(),
        messageId: text('message_id').notNull(),
        partIndex: integer('part_index').notNull(),
        type: text('type').notNull(),
        text: text('text'),
        thinkingText: text('thinking_text'),
        toolCallId: text('tool_call_id'),
        toolName: text('tool_name'),
        argumentsJson: text('arguments_json'),
        resultJson: text('result_json'),
        mimeType: text('mime_type'),
        rawJson: text('raw_json').notNull(),
        syncedAt: text('synced_at').notNull(),
    },
    (table) => ({
        sessionKeyIdx: index('session_message_parts_session_key_idx').on(table.sessionKey),
        messageIdIdx: index('session_message_parts_message_id_idx').on(table.messageId),
        toolCallIdIdx: index('session_message_parts_tool_call_id_idx').on(table.toolCallId),
    })
);

export const sessionToolCallsTable = sqliteTable(
    'session_tool_calls',
    {
        id: text('id').primaryKey(),
        sessionKey: text('session_key').notNull(),
        messageId: text('message_id'),
        toolCallId: text('tool_call_id'),
        toolName: text('tool_name').notNull(),
        agentId: text('agent_id'),
        argumentsJson: text('arguments_json'),
        resultJson: text('result_json'),
        childSessionKey: text('child_session_key'),
        runId: text('run_id'),
        isError: integer('is_error', { mode: 'boolean' }),
        startedAt: text('started_at'),
        finishedAt: text('finished_at'),
        updatedAt: text('updated_at').notNull(),
        rawJson: text('raw_json').notNull(),
    },
    (table) => ({
        sessionKeyIdx: index('session_tool_calls_session_key_idx').on(table.sessionKey),
        toolCallIdIdx: index('session_tool_calls_tool_call_id_idx').on(table.toolCallId),
        childSessionKeyIdx: index('session_tool_calls_child_session_key_idx').on(
            table.childSessionKey
        ),
    })
);

export const sessionLinksTable = sqliteTable(
    'session_links',
    {
        id: text('id').primaryKey(),
        parentSessionKey: text('parent_session_key').notNull(),
        childSessionKey: text('child_session_key').notNull(),
        linkType: text('link_type').notNull(),
        sourceMessageId: text('source_message_id'),
        sourceToolCallId: text('source_tool_call_id'),
        runId: text('run_id'),
        deliveryMode: text('delivery_mode'),
        payloadJson: text('payload_json'),
        createdAt: text('created_at').notNull(),
        updatedAt: text('updated_at').notNull(),
    },
    (table) => ({
        parentSessionKeyIdx: index('session_links_parent_session_key_idx').on(
            table.parentSessionKey
        ),
        childSessionKeyIdx: index('session_links_child_session_key_idx').on(table.childSessionKey),
        linkTypeIdx: index('session_links_link_type_idx').on(table.linkType),
    })
);

export const sessionDeliveriesTable = sqliteTable(
    'session_deliveries',
    {
        id: text('id').primaryKey(),
        parentSessionKey: text('parent_session_key').notNull(),
        childSessionKey: text('child_session_key').notNull(),
        sourceMessageId: text('source_message_id'),
        targetMessageId: text('target_message_id'),
        mode: text('mode'),
        status: text('status'),
        runId: text('run_id'),
        cronJobId: text('cron_job_id'),
        deliveryChannel: text('delivery_channel'),
        deliveryTarget: text('delivery_target'),
        transcriptPath: text('transcript_path'),
        streamLogPath: text('stream_log_path'),
        statsJson: text('stats_json'),
        deliveredAt: text('delivered_at'),
        payloadJson: text('payload_json'),
        createdAt: text('created_at').notNull(),
        updatedAt: text('updated_at').notNull(),
    },
    (table) => ({
        parentSessionKeyIdx: index('session_deliveries_parent_session_key_idx').on(
            table.parentSessionKey
        ),
        childSessionKeyIdx: index('session_deliveries_child_session_key_idx').on(
            table.childSessionKey
        ),
        cronJobIdIdx: index('session_deliveries_cron_job_id_idx').on(table.cronJobId),
        deliveredAtIdx: index('session_deliveries_delivered_at_idx').on(table.deliveredAt),
    })
);

export const sessionAccessEventsTable = sqliteTable(
    'session_access_events',
    {
        id: text('id').primaryKey(),
        sessionKey: text('session_key').notNull(),
        targetSessionKey: text('target_session_key'),
        sourceMessageId: text('source_message_id'),
        sourceToolCallId: text('source_tool_call_id'),
        toolName: text('tool_name'),
        status: text('status').notNull(),
        errorCode: text('error_code'),
        errorMessage: text('error_message'),
        occurredAt: text('occurred_at').notNull(),
        payloadJson: text('payload_json'),
    },
    (table) => ({
        sessionKeyIdx: index('session_access_events_session_key_idx').on(table.sessionKey),
        targetSessionKeyIdx: index('session_access_events_target_session_key_idx').on(
            table.targetSessionKey
        ),
        occurredAtIdx: index('session_access_events_occurred_at_idx').on(table.occurredAt),
    })
);

export const sessionArtifactsTable = sqliteTable(
    'session_artifacts',
    {
        id: text('id').primaryKey(),
        sessionKey: text('session_key').notNull(),
        runId: text('run_id'),
        messageId: text('message_id'),
        toolCallId: text('tool_call_id'),
        artifactType: text('artifact_type').notNull(),
        path: text('path'),
        mimeType: text('mime_type'),
        sizeBytes: integer('size_bytes'),
        payloadJson: text('payload_json'),
        createdAt: text('created_at').notNull(),
        updatedAt: text('updated_at').notNull(),
    },
    (table) => ({
        sessionKeyIdx: index('session_artifacts_session_key_idx').on(table.sessionKey),
        runIdIdx: index('session_artifacts_run_id_idx').on(table.runId),
        messageIdIdx: index('session_artifacts_message_id_idx').on(table.messageId),
        artifactTypeIdx: index('session_artifacts_artifact_type_idx').on(table.artifactType),
    })
);

export type SessionRunRecord = typeof sessionRunsTable.$inferSelect;
export type SessionMessageRecord = typeof sessionMessagesTable.$inferSelect;
export type SessionMessagePartRecord = typeof sessionMessagePartsTable.$inferSelect;
export type SessionToolCallRecord = typeof sessionToolCallsTable.$inferSelect;
export type SessionLinkRecord = typeof sessionLinksTable.$inferSelect;
export type SessionDeliveryRecord = typeof sessionDeliveriesTable.$inferSelect;
export type SessionAccessEventRecord = typeof sessionAccessEventsTable.$inferSelect;
export type SessionArtifactRecord = typeof sessionArtifactsTable.$inferSelect;
