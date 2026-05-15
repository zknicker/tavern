import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const modelCatalogTable = sqliteTable(
    'model_catalog',
    {
        contextWindow: integer('context_window'),
        createdAt: text('created_at').notNull(),
        displayName: text('display_name').notNull(),
        id: text('id').primaryKey(),
        modelId: text('model_id').notNull(),
        provider: text('provider').notNull(),
        updatedAt: text('updated_at').notNull(),
    },
    (table) => ({
        providerModelIdx: uniqueIndex('model_catalog_provider_model_idx').on(
            table.provider,
            table.modelId
        ),
    })
);

export const openClawModelNamesTable = sqliteTable(
    'openclaw_model_names',
    {
        createdAt: text('created_at').notNull(),
        harness: text('harness').notNull(),
        id: text('id').primaryKey(),
        isPreferred: integer('is_preferred', { mode: 'boolean' }).notNull().default(false),
        modelCatalogId: text('model_catalog_id').notNull(),
        openClawModel: text('openclaw_model').notNull(),
        openClawProvider: text('openclaw_provider').notNull(),
        updatedAt: text('updated_at').notNull(),
    },
    (table) => ({
        modelCatalogIdx: index('openclaw_model_names_model_catalog_idx').on(table.modelCatalogId),
        modelNameIdx: uniqueIndex('openclaw_model_names_name_idx').on(
            table.harness,
            table.openClawProvider,
            table.openClawModel
        ),
    })
);

export const runtimeModelAvailabilityTable = sqliteTable(
    'runtime_model_availability',
    {
        detailsJson: text('details_json'),
        id: text('id').primaryKey(),
        lastCheckedAt: text('last_checked_at').notNull(),
        openClawModelNameId: text('openclaw_model_name_id').notNull(),
        runtimeId: text('runtime_id').notNull(),
        source: text('source').notNull(),
        status: text('status').notNull(),
    },
    (table) => ({
        modelNameIdx: index('runtime_model_availability_model_name_idx').on(
            table.openClawModelNameId
        ),
        runtimeModelIdx: uniqueIndex('runtime_model_availability_runtime_model_idx').on(
            table.runtimeId,
            table.openClawModelNameId
        ),
    })
);

export const agentModelSettingsTable = sqliteTable(
    'agent_model_settings',
    {
        agentId: text('agent_id').primaryKey(),
        harness: text('harness').notNull(),
        modelCatalogId: text('model_catalog_id').notNull(),
        openClawModelNameId: text('openclaw_model_name_id').notNull(),
        syncError: text('sync_error'),
        syncedAt: text('synced_at'),
        updatedAt: text('updated_at').notNull(),
    },
    (table) => ({
        modelCatalogIdx: index('agent_model_settings_model_catalog_idx').on(table.modelCatalogId),
        openClawModelNameIdx: index('agent_model_settings_openclaw_model_name_idx').on(
            table.openClawModelNameId
        ),
    })
);

export type AgentModelSettingsRecord = typeof agentModelSettingsTable.$inferSelect;
export type ModelCatalogRecord = typeof modelCatalogTable.$inferSelect;
export type OpenClawModelNameRecord = typeof openClawModelNamesTable.$inferSelect;
export type RuntimeModelAvailabilityRecord = typeof runtimeModelAvailabilityTable.$inferSelect;
