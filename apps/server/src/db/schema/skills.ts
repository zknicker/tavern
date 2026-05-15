import { index, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const skillPackagesTable = sqliteTable(
    'skill_packages',
    {
        allowedTools: text('allowed_tools'),
        cachePath: text('cache_path').notNull(),
        contentHash: text('content_hash').notNull(),
        createdAt: text('created_at').notNull(),
        description: text('description'),
        displayName: text('display_name').notNull(),
        filesJson: text('files_json').notNull(),
        id: text('id').primaryKey(),
        installSourceJson: text('install_source_json').notNull(),
        latestCheckError: text('latest_check_error'),
        latestCheckedAt: text('latest_checked_at'),
        latestSourceUpdatedAt: text('latest_source_updated_at'),
        latestVersion: text('latest_version'),
        latestVersionCreatedAt: text('latest_version_created_at'),
        metadataJson: text('metadata_json').notNull(),
        resolvedVersion: text('resolved_version'),
        skillName: text('skill_name').notNull(),
        sourceSpec: text('source_spec').notNull(),
        sourceType: text('source_type').notNull(),
        sourceVersion: text('source_version'),
        updatedAt: text('updated_at').notNull(),
    },
    (table) => ({
        contentHashIdx: index('skill_packages_content_hash_idx').on(table.contentHash),
        latestCheckedAtIdx: index('skill_packages_latest_checked_at_idx').on(table.latestCheckedAt),
        sourceIdx: index('skill_packages_source_idx').on(table.sourceType, table.sourceSpec),
        sourceVersionIdx: uniqueIndex('skill_packages_source_version_idx').on(
            table.sourceType,
            table.sourceSpec,
            table.resolvedVersion
        ),
    })
);

export const agentSkillSelectionsTable = sqliteTable(
    'agent_skill_selections',
    {
        agentId: text('agent_id').notNull(),
        desiredHash: text('desired_hash').notNull(),
        materializedName: text('materialized_name').notNull(),
        observedJson: text('observed_json'),
        skillPackageId: text('skill_package_id').notNull(),
        syncError: text('sync_error'),
        syncedAt: text('synced_at'),
        updatedAt: text('updated_at').notNull(),
    },
    (table) => ({
        agentIdx: index('agent_skill_selections_agent_idx').on(table.agentId),
        packageIdx: index('agent_skill_selections_package_idx').on(table.skillPackageId),
        pk: primaryKey({
            columns: [table.agentId, table.skillPackageId],
        }),
    })
);

export type AgentSkillSelectionRecord = typeof agentSkillSelectionsTable.$inferSelect;
export type SkillPackageRecord = typeof skillPackagesTable.$inferSelect;
