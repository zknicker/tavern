import { and, asc, eq, isNull, lt, or } from 'drizzle-orm';
import { db } from '../db/index.ts';
import {
    type AgentSkillSelectionRecord,
    agentSkillSelectionsTable,
    type SkillPackageRecord,
    skillPackagesTable,
} from '../db/schema.ts';

export type { AgentSkillSelectionRecord, SkillPackageRecord };

export interface SaveSkillPackageInput {
    allowedTools: string | null;
    cachePath: string;
    contentHash: string;
    description: string | null;
    displayName: string;
    filesJson: string;
    id: string;
    installSourceJson: string;
    metadataJson: string;
    resolvedVersion: string | null;
    skillName: string;
    sourceSpec: string;
    sourceType: string;
    sourceVersion: string | null;
}

export interface SaveSkillUpdateCheckInput {
    latestCheckError: string | null;
    latestCheckedAt: string;
    latestSourceUpdatedAt: string | null;
    latestVersion: string | null;
    latestVersionCreatedAt: string | null;
    skillPackageId: string;
}

export async function listSkillPackages() {
    return await db.select().from(skillPackagesTable).orderBy(asc(skillPackagesTable.displayName));
}

export async function getSkillPackage(packageId: string) {
    const [record] = await db
        .select()
        .from(skillPackagesTable)
        .where(eq(skillPackagesTable.id, packageId))
        .limit(1);
    return record ?? null;
}

export async function findSkillPackageBySource(input: {
    resolvedVersion: string | null;
    sourceSpec: string;
    sourceType: string;
}) {
    const rows = await db
        .select()
        .from(skillPackagesTable)
        .where(
            and(
                eq(skillPackagesTable.sourceType, input.sourceType),
                eq(skillPackagesTable.sourceSpec, input.sourceSpec)
            )
        );

    return (
        rows.find((row) => row.resolvedVersion === input.resolvedVersion) ??
        rows.find((row) => row.resolvedVersion === null && input.resolvedVersion === null) ??
        null
    );
}

export async function saveSkillPackage(input: SaveSkillPackageInput) {
    const timestamp = new Date().toISOString();
    const values = {
        allowedTools: input.allowedTools,
        cachePath: input.cachePath,
        contentHash: input.contentHash,
        description: input.description,
        displayName: input.displayName,
        filesJson: input.filesJson,
        installSourceJson: input.installSourceJson,
        latestCheckError: null,
        latestCheckedAt: null,
        latestSourceUpdatedAt: null,
        latestVersion: null,
        latestVersionCreatedAt: null,
        metadataJson: input.metadataJson,
        resolvedVersion: input.resolvedVersion,
        skillName: input.skillName,
        sourceSpec: input.sourceSpec,
        sourceType: input.sourceType,
        sourceVersion: input.sourceVersion,
        updatedAt: timestamp,
    };

    await db
        .insert(skillPackagesTable)
        .values({
            ...values,
            createdAt: timestamp,
            id: input.id,
        })
        .onConflictDoUpdate({
            target: skillPackagesTable.id,
            set: values,
        });

    return await getSkillPackage(input.id);
}

export async function listDueClawHubSkillPackages(cutoffIso: string) {
    return await db
        .select()
        .from(skillPackagesTable)
        .where(
            and(
                eq(skillPackagesTable.sourceType, 'clawhub'),
                or(
                    isNull(skillPackagesTable.latestCheckedAt),
                    lt(skillPackagesTable.latestCheckedAt, cutoffIso)
                )
            )
        )
        .orderBy(asc(skillPackagesTable.latestCheckedAt), asc(skillPackagesTable.displayName));
}

export async function saveSkillUpdateCheck(input: SaveSkillUpdateCheckInput) {
    await db
        .update(skillPackagesTable)
        .set({
            latestCheckError: input.latestCheckError,
            latestCheckedAt: input.latestCheckedAt,
            latestSourceUpdatedAt: input.latestSourceUpdatedAt,
            latestVersion: input.latestVersion,
            latestVersionCreatedAt: input.latestVersionCreatedAt,
            updatedAt: new Date().toISOString(),
        })
        .where(eq(skillPackagesTable.id, input.skillPackageId));
}

export async function deleteSkillPackage(packageId: string) {
    await db
        .delete(agentSkillSelectionsTable)
        .where(eq(agentSkillSelectionsTable.skillPackageId, packageId));
    await db.delete(skillPackagesTable).where(eq(skillPackagesTable.id, packageId));
}

export async function listAgentSkillSelections(agentId: string) {
    return await db
        .select()
        .from(agentSkillSelectionsTable)
        .where(eq(agentSkillSelectionsTable.agentId, agentId))
        .orderBy(asc(agentSkillSelectionsTable.materializedName));
}

export async function listAllAgentSkillSelections() {
    return await db.select().from(agentSkillSelectionsTable);
}

export async function listSkillSelectionsByPackage(packageId: string) {
    return await db
        .select()
        .from(agentSkillSelectionsTable)
        .where(eq(agentSkillSelectionsTable.skillPackageId, packageId));
}

export async function replaceAgentSkillSelections(input: {
    agentId: string;
    packages: Array<{ materializedName: string; package: SkillPackageRecord }>;
}) {
    const timestamp = new Date().toISOString();
    await db
        .delete(agentSkillSelectionsTable)
        .where(eq(agentSkillSelectionsTable.agentId, input.agentId));

    for (const item of input.packages) {
        await db.insert(agentSkillSelectionsTable).values({
            agentId: input.agentId,
            desiredHash: item.package.contentHash,
            materializedName: item.materializedName,
            observedJson: null,
            skillPackageId: item.package.id,
            syncError: null,
            syncedAt: null,
            updatedAt: timestamp,
        });
    }
}

export async function saveAgentSkillSyncState(input: {
    agentId: string;
    observedJson: string | null;
    skillPackageId: string;
    syncError: string | null;
}) {
    await db
        .update(agentSkillSelectionsTable)
        .set({
            observedJson: input.observedJson,
            syncError: input.syncError,
            syncedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        })
        .where(
            and(
                eq(agentSkillSelectionsTable.agentId, input.agentId),
                eq(agentSkillSelectionsTable.skillPackageId, input.skillPackageId)
            )
        );
}
