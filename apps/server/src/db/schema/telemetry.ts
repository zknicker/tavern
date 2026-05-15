import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const telemetryIngestCursorsTable = sqliteTable(
    'telemetry_ingest_cursors',
    {
        id: text('id').primaryKey(),
        source: text('source').notNull(),
        cursorKey: text('cursor_key').notNull(),
        cursorJson: text('cursor_json').notNull(),
        updatedAt: text('updated_at').notNull(),
    },
    (table) => ({
        sourceCursorKeyIdx: index('telemetry_ingest_cursors_source_key_idx').on(
            table.source,
            table.cursorKey
        ),
    })
);

export const apiUsageEventsTable = sqliteTable(
    'api_usage_events',
    {
        id: text('id').primaryKey(),
        source: text('source').notNull(),
        sourceEventId: text('source_event_id'),
        occurredAt: text('occurred_at').notNull(),
        observedAt: text('observed_at').notNull(),
        provider: text('provider').notNull(),
        credentialLabel: text('credential_label').notNull(),
        taskType: text('task_type').notNull(),
        model: text('model'),
        workspaceLabel: text('workspace_label'),
        inputTokens: integer('input_tokens').notNull().default(0),
        outputTokens: integer('output_tokens').notNull().default(0),
        cacheReadTokens: integer('cache_read_tokens').notNull().default(0),
        cacheWriteTokens: integer('cache_write_tokens').notNull().default(0),
        totalTokens: integer('total_tokens').notNull().default(0),
        estimatedCostCents: integer('estimated_cost_cents').notNull().default(0),
        pricingVersion: text('pricing_version'),
        metaJson: text('meta_json'),
    },
    (table) => ({
        occurredAtIdx: index('api_usage_events_occurred_at_idx').on(table.occurredAt),
        providerLabelOccurredIdx: index('api_usage_events_provider_label_occurred_idx').on(
            table.provider,
            table.credentialLabel,
            table.occurredAt
        ),
        sourceEventIdIdx: index('api_usage_events_source_event_id_idx').on(
            table.source,
            table.sourceEventId
        ),
    })
);

export const apiUsageHourlyTable = sqliteTable(
    'api_usage_hourly',
    {
        bucketStart: text('bucket_start').notNull(),
        source: text('source').notNull(),
        provider: text('provider').notNull(),
        credentialLabel: text('credential_label').notNull(),
        taskType: text('task_type').notNull(),
        model: text('model').notNull().default('unknown'),
        requestCount: integer('request_count').notNull().default(0),
        inputTokens: integer('input_tokens').notNull().default(0),
        outputTokens: integer('output_tokens').notNull().default(0),
        cacheReadTokens: integer('cache_read_tokens').notNull().default(0),
        cacheWriteTokens: integer('cache_write_tokens').notNull().default(0),
        totalTokens: integer('total_tokens').notNull().default(0),
        estimatedCostCents: integer('estimated_cost_cents').notNull().default(0),
        pricingVersion: text('pricing_version'),
    },
    (table) => ({
        pk: primaryKey({
            columns: [
                table.bucketStart,
                table.source,
                table.provider,
                table.credentialLabel,
                table.taskType,
                table.model,
            ],
        }),
        bucketStartIdx: index('api_usage_hourly_bucket_start_idx').on(table.bucketStart),
        providerLabelBucketIdx: index('api_usage_hourly_provider_label_bucket_idx').on(
            table.provider,
            table.credentialLabel,
            table.bucketStart
        ),
    })
);

export type TelemetryIngestCursorRecord = typeof telemetryIngestCursorsTable.$inferSelect;
export type ApiUsageEventRecord = typeof apiUsageEventsTable.$inferSelect;
export type ApiUsageHourlyRecord = typeof apiUsageHourlyTable.$inferSelect;
