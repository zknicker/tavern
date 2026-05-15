import { and, eq, inArray, notInArray } from 'drizzle-orm';
import { db } from '../db/index.ts';
import {
    agentModelSettingsTable,
    modelCatalogTable,
    openClawModelNamesTable,
    runtimeModelAvailabilityTable,
} from '../db/schema.ts';
import {
    formatOpenClawModelNameDefinitionId,
    formatTavernModelId,
    type OpenClawHarness,
    openClawModelNames,
    tavernModelCatalog,
} from '../model/openclaw-mapping.ts';

export async function seedModelCatalog() {
    const timestamp = new Date().toISOString();

    for (const model of tavernModelCatalog) {
        const id = formatTavernModelId(model);

        await db
            .insert(modelCatalogTable)
            .values({
                contextWindow: model.contextWindow,
                createdAt: timestamp,
                displayName: model.displayName,
                id,
                modelId: model.modelId,
                provider: model.provider,
                updatedAt: timestamp,
            })
            .onConflictDoUpdate({
                target: modelCatalogTable.id,
                set: {
                    contextWindow: model.contextWindow,
                    displayName: model.displayName,
                    modelId: model.modelId,
                    provider: model.provider,
                    updatedAt: timestamp,
                },
            });
    }

    for (const name of openClawModelNames) {
        await db
            .insert(openClawModelNamesTable)
            .values({
                createdAt: timestamp,
                harness: name.harness,
                id: formatOpenClawModelNameDefinitionId(name),
                isPreferred: name.isPreferred,
                modelCatalogId: name.modelCatalogId,
                openClawModel: name.openClawModel,
                openClawProvider: name.openClawProvider,
                updatedAt: timestamp,
            })
            .onConflictDoUpdate({
                target: openClawModelNamesTable.id,
                set: {
                    harness: name.harness,
                    isPreferred: name.isPreferred,
                    modelCatalogId: name.modelCatalogId,
                    openClawModel: name.openClawModel,
                    openClawProvider: name.openClawProvider,
                    updatedAt: timestamp,
                },
            });
    }

    const currentNameIds = openClawModelNames.map(formatOpenClawModelNameDefinitionId);
    await db
        .delete(runtimeModelAvailabilityTable)
        .where(notInArray(runtimeModelAvailabilityTable.openClawModelNameId, currentNameIds));
    await db
        .delete(openClawModelNamesTable)
        .where(notInArray(openClawModelNamesTable.id, currentNameIds));
}

export async function listModelCatalogRecords() {
    await seedModelCatalog();
    return await db.select().from(modelCatalogTable);
}

export async function listOpenClawModelNameRecords() {
    await seedModelCatalog();
    return await db.select().from(openClawModelNamesTable);
}

export async function getOpenClawModelNameRecord(id: string) {
    await seedModelCatalog();
    const [record] = await db
        .select()
        .from(openClawModelNamesTable)
        .where(eq(openClawModelNamesTable.id, id))
        .limit(1);

    return record ?? null;
}

export async function listRuntimeModelAvailability(runtimeIds: string[]) {
    if (runtimeIds.length === 0) {
        return [];
    }

    return await db
        .select()
        .from(runtimeModelAvailabilityTable)
        .where(inArray(runtimeModelAvailabilityTable.runtimeId, runtimeIds));
}

export async function syncRuntimeModelAvailability(input: {
    modelNameIds: string[];
    runtimeId: string;
    source: string;
    status: 'available' | 'degraded' | 'unavailable';
}) {
    const timestamp = new Date().toISOString();

    for (const modelNameId of input.modelNameIds) {
        await db
            .insert(runtimeModelAvailabilityTable)
            .values({
                detailsJson: null,
                id: modelNameId,
                lastCheckedAt: timestamp,
                openClawModelNameId: modelNameId,
                runtimeId: input.runtimeId,
                source: input.source,
                status: input.status,
            })
            .onConflictDoUpdate({
                target: runtimeModelAvailabilityTable.id,
                set: {
                    lastCheckedAt: timestamp,
                    source: input.source,
                    status: input.status,
                },
            });
    }
}

export async function listAgentModelSettings(agentIds: string[]) {
    if (agentIds.length === 0) {
        return [];
    }

    return await db
        .select()
        .from(agentModelSettingsTable)
        .where(inArray(agentModelSettingsTable.agentId, agentIds));
}

export async function getAgentModelSetting(agentId: string) {
    const [record] = await db
        .select()
        .from(agentModelSettingsTable)
        .where(eq(agentModelSettingsTable.agentId, agentId))
        .limit(1);

    return record ?? null;
}

export async function saveAgentModelSetting(input: {
    agentId: string;
    harness: OpenClawHarness;
    modelCatalogId: string;
    openClawModelNameId: string;
    syncError?: string | null;
    syncedAt?: string | null;
}) {
    const timestamp = new Date().toISOString();

    await db
        .insert(agentModelSettingsTable)
        .values({
            agentId: input.agentId,
            harness: input.harness,
            modelCatalogId: input.modelCatalogId,
            openClawModelNameId: input.openClawModelNameId,
            syncError: input.syncError ?? null,
            syncedAt: input.syncedAt ?? null,
            updatedAt: timestamp,
        })
        .onConflictDoUpdate({
            target: agentModelSettingsTable.agentId,
            set: {
                harness: input.harness,
                modelCatalogId: input.modelCatalogId,
                openClawModelNameId: input.openClawModelNameId,
                syncError: input.syncError ?? null,
                syncedAt: input.syncedAt ?? null,
                updatedAt: timestamp,
            },
        });
}

export async function updateAgentModelSettingSync(input: {
    agentId: string;
    syncError: string | null;
    syncedAt: string | null;
}) {
    await db
        .update(agentModelSettingsTable)
        .set({
            syncError: input.syncError,
            syncedAt: input.syncedAt,
        })
        .where(and(eq(agentModelSettingsTable.agentId, input.agentId)));
}
