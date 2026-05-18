import fs from 'node:fs/promises';
import path from 'node:path';
import type { AgentRuntimeSkillFile } from '@tavern/api';
import { z } from 'zod';
import { createAgentRuntimeClientForConnection } from '../agent-runtime/client-factory.ts';
import { resolveAgentDefaultPrimaryColor } from '../agents/palette.ts';
import { emitSkillInvalidationCascade } from '../api/invalidation-events.ts';
import { applyCurrentOpenClawConfigFixups } from '../openclaw-config/service.ts';
import { getAgentRuntimeConnection } from '../storage/agent-runtime-connections.ts';
import {
    getAgent as getAgentProjection,
    listAgents,
    updateAgentEnabledSkillIds,
} from '../storage/agents.ts';
import {
    deleteTavernVaultSecret,
    getSkillEnvSecretId,
    getTavernVaultSecret,
    saveTavernVaultSecret,
} from '../storage/tavern-vault.ts';
import {
    checkSkillUpdatesInputSchema,
    deleteSkillInputSchema,
    deleteSkillSecretInputSchema,
    getSkillInputSchema,
    installSkillInputSchema,
    type SkillDetail,
    type SkillList,
    saveSkillSecretInputSchema,
    skillGetSchema,
    skillListSchema,
    skillSummarySchema,
} from './contracts.ts';
import { parseSkillMarkdown } from './markdown.ts';
import { syncAgentWorkspaceSkills } from './materialize.ts';
import { readSkillInstallOptions, readSkillSecretEnvNames } from './metadata.ts';
import { sanitizeMaterializedSkillName } from './package-files.ts';
import { installSkillPackage } from './package-sources.ts';
import {
    deleteSkillPackage,
    getSkillPackage,
    listAllAgentSkillSelections,
    listSkillPackages,
    listSkillSelectionsByPackage,
    replaceAgentSkillSelections,
    type SkillPackageRecord,
} from './storage.ts';
import { checkClawHubSkillPackageForUpdates } from './update-check.ts';
import {
    aggregateInstallOptions,
    aggregateRequirements,
    groupSelectionsByPackage,
    parseObservedSkill,
    resolveDependencyState,
} from './view-model.ts';

const skillSecretValueSchema = z.object({
    value: z.string(),
});

export async function listSkills(): Promise<SkillList> {
    const [packages, selections] = await Promise.all([
        listSkillPackages(),
        listAllAgentSkillSelections(),
    ]);
    const selectionsByPackage = groupSelectionsByPackage(selections);

    return skillListSchema.parse({
        skills: packages.map((skillPackage) =>
            buildSkillSummary({
                package: skillPackage,
                selections: selectionsByPackage.get(skillPackage.id) ?? [],
            })
        ),
    });
}

export async function getSkill(input: unknown): Promise<{ skill: SkillDetail | null }> {
    const parsed = getSkillInputSchema.parse(input);
    const skillPackage = await getSkillPackage(parsed.skillId);

    if (!skillPackage) {
        return skillGetSchema.parse({ skill: null });
    }

    const [contentMarkdown, selections, agents, secrets] = await Promise.all([
        readSkillMarkdown(skillPackage.cachePath),
        listAllAgentSkillSelections(),
        listAgents({ includeInactive: true }),
        listSkillSecretStatuses(skillPackage),
    ]);
    const packageSelections = selections.filter(
        (selection) => selection.skillPackageId === skillPackage.id
    );
    const agentsById = new Map(agents.map((agent) => [agent.id, agent]));
    const metadata = parseSkillMarkdown({
        contentMarkdown,
        skillId: skillPackage.id,
    });
    const summary = buildSkillSummary({
        package: skillPackage,
        selections: packageSelections,
    });

    return skillGetSchema.parse({
        skill: {
            ...summary,
            allowedTools: metadata.allowedTools,
            assignedAgents: buildAssignedAgents({
                agentsById,
                selections: packageSelections,
            }),
            bodyMarkdown: metadata.bodyMarkdown,
            contentMarkdown,
            files: parseFiles(skillPackage.filesJson),
            install: aggregateInstallOptions(packageSelections),
            installSource: parseInstallSource(skillPackage.installSourceJson),
            license: metadata.license,
            metadata: metadata.metadata,
            requirements: aggregateRequirements(packageSelections, 'requirements'),
            secrets,
            setupCommands: buildSetupCommands(metadata.metadata, summary.missing),
        },
    });
}

export async function installSkill(input: unknown) {
    const parsed = installSkillInputSchema.parse(input);
    const skillPackage = await installSkillPackage(parsed);
    emitSkillInvalidationCascade();

    return await getSkill({
        skillId: skillPackage.id,
    });
}

export async function deleteSkill(input: unknown) {
    const parsed = deleteSkillInputSchema.parse(input);
    const skillPackage = await getSkillPackage(parsed.skillId);

    if (!skillPackage) {
        return { deleted: false } as const;
    }

    const selections = await listSkillSelectionsByPackage(skillPackage.id);
    await deleteSkillPackage(skillPackage.id);
    await fs.rm(skillPackage.cachePath, { force: true, recursive: true });
    await Promise.all(
        readSkillSecretEnvNames(parseSkillPackageMetadata(skillPackage)).map((envName) =>
            deleteTavernVaultSecret(
                getSkillEnvSecretId({
                    envName,
                    skillPackageId: skillPackage.id,
                })
            )
        )
    );
    await Promise.all(
        [...new Set(selections.map((selection) => selection.agentId))].map(async (agentId) => {
            const agent = await getAgentProjection(agentId);
            if (agent) {
                await updateAgentEnabledSkillIds({
                    agentId,
                    enabledSkillIds: parseProjectionSkillIds(agent).filter(
                        (skillId) => skillId !== skillPackage.id
                    ),
                });
            }
            await syncAgentSkills(agentId).catch(() => undefined);
        })
    );
    await applyCurrentOpenClawConfigFixups().catch(() => undefined);
    emitSkillInvalidationCascade();

    return { deleted: true } as const;
}

export async function saveSkillSecret(input: unknown) {
    const parsed = saveSkillSecretInputSchema.parse(input);
    const skillPackage = await requireSkillPackage(parsed.skillId);
    validateSkillSecretEnvName({
        envName: parsed.envName,
        skillPackage,
    });

    await saveTavernVaultSecret({
        id: getSkillEnvSecretId({
            envName: parsed.envName,
            skillPackageId: skillPackage.id,
        }),
        secret: {
            value: parsed.value,
        },
    });
    await applyCurrentOpenClawConfigFixups().catch(() => undefined);
    emitSkillInvalidationCascade();

    return await getSkill({ skillId: skillPackage.id });
}

export async function deleteSkillSecret(input: unknown) {
    const parsed = deleteSkillSecretInputSchema.parse(input);
    const skillPackage = await requireSkillPackage(parsed.skillId);
    validateSkillSecretEnvName({
        envName: parsed.envName,
        skillPackage,
    });

    await deleteTavernVaultSecret(
        getSkillEnvSecretId({
            envName: parsed.envName,
            skillPackageId: skillPackage.id,
        })
    );
    await applyCurrentOpenClawConfigFixups().catch(() => undefined);
    emitSkillInvalidationCascade();

    return await getSkill({ skillId: skillPackage.id });
}

export async function checkSkillForUpdates(input: unknown) {
    const parsed = checkSkillUpdatesInputSchema.parse(input);
    const skillPackage = await getSkillPackage(parsed.skillId);

    if (!skillPackage) {
        throw new Error('Skill not found.');
    }

    await checkClawHubSkillPackageForUpdates(skillPackage);
    emitSkillInvalidationCascade();

    const result = await getSkill({ skillId: skillPackage.id });
    if (!result.skill) {
        throw new Error('Skill not found.');
    }

    return {
        skill: result.skill,
    };
}

export async function saveAgentSkillSelections(input: {
    agentId: string;
    enabledSkillIds: string[] | null;
}) {
    const enabledSkillIds = input.enabledSkillIds ?? [];
    const packages = await Promise.all(enabledSkillIds.map((skillId) => getSkillPackage(skillId)));
    const missing = enabledSkillIds.filter((_, index) => !packages[index]);

    if (missing.length > 0) {
        throw new Error(`Unknown skills: ${missing.join(', ')}.`);
    }

    const materialized = buildMaterializedSelections(
        packages.filter((skillPackage): skillPackage is SkillPackageRecord => Boolean(skillPackage))
    );
    await replaceAgentSkillSelections({
        agentId: input.agentId,
        packages: materialized,
    });
    await syncAgentSkills(input.agentId);
    await applyCurrentOpenClawConfigFixups().catch(() => undefined);
    emitSkillInvalidationCascade();

    return enabledSkillIds;
}

export async function listSkillPackageIds() {
    return (await listSkillPackages()).map((skillPackage) => skillPackage.id);
}

async function syncAgentSkills(agentId: string) {
    const agent = await getAgentProjection(agentId);
    if (!agent) {
        return;
    }

    const runtime = await getAgentRuntimeConnection(agent.runtimeId);
    if (!runtime?.enabled) {
        throw new Error('Tavern Runtime is not configured.');
    }

    const runtimeClient = createAgentRuntimeClientForConnection(runtime);
    const packages = await listSkillPackages();
    await syncAgentWorkspaceSkills({
        agent,
        packages,
        runtimeClient,
    });
}

function buildMaterializedSelections(packages: SkillPackageRecord[]) {
    const used = new Set<string>();

    return packages.map((skillPackage) => {
        const baseName = sanitizeMaterializedSkillName(skillPackage.skillName);
        let materializedName = baseName;
        let index = 2;
        while (used.has(materializedName)) {
            materializedName = `${baseName}-${index}`;
            index += 1;
        }
        used.add(materializedName);

        return {
            materializedName,
            package: skillPackage,
        };
    });
}

function buildSkillSummary(input: {
    package: SkillPackageRecord;
    selections: Awaited<ReturnType<typeof listAllAgentSkillSelections>>;
}) {
    const dependencyState = resolveDependencyState(input.selections);

    return skillSummarySchema.parse({
        agentCount: input.selections.length,
        allowedTools: input.package.allowedTools,
        dependencyState,
        description: input.package.description,
        id: input.package.id,
        installSource: parseInstallSource(input.package.installSourceJson),
        latestVersion: input.package.latestVersion,
        missing: aggregateRequirements(input.selections, 'missing'),
        name: input.package.displayName,
        updateAvailable:
            input.package.latestVersion !== null &&
            input.package.latestVersion !== input.package.resolvedVersion,
        updateCheckedAt: input.package.latestCheckedAt,
        updateError: input.package.latestCheckError,
        updatedAt: input.package.updatedAt,
        version: input.package.resolvedVersion,
    });
}

function buildAssignedAgents(input: {
    agentsById: Map<string, Awaited<ReturnType<typeof listAgents>>[number]>;
    selections: Awaited<ReturnType<typeof listAllAgentSkillSelections>>;
}) {
    return input.selections
        .map((selection) => {
            const agent = input.agentsById.get(selection.agentId);
            const observed = parseObservedSkill(selection.observedJson);
            const agentName = agent?.name ?? selection.agentId;

            return {
                agentId: selection.agentId,
                agentAvatar: resolveAssignedAgentAvatar({
                    agent,
                    fallback: agentName,
                }),
                agentName,
                agentPrimaryColor:
                    agent?.primaryColor ?? resolveAgentDefaultPrimaryColor(selection.agentId),
                baseDir: observed?.baseDir ?? null,
                commandVisible: observed?.commandVisible ?? null,
                configChecks: observed?.configChecks ?? [],
                dependencyState: resolveSelectionDependencyState(selection),
                eligible: observed?.eligible ?? null,
                materializedName: selection.materializedName,
                missing: observed?.missing ?? emptyRequirements(),
                modelVisible: observed?.modelVisible ?? null,
                requirements: observed?.requirements ?? emptyRequirements(),
                runtimeId: agent?.runtimeId ?? 'unknown',
                syncError: selection.syncError,
            };
        })
        .sort((left, right) => left.agentName.localeCompare(right.agentName));
}

function buildSetupCommands(
    metadata: SkillDetail['metadata'],
    missing: SkillDetail['missing']
): SkillDetail['setupCommands'] {
    const missingBins = new Set([...missing.bins, ...missing.anyBins]);
    if (missingBins.size === 0) {
        return [];
    }

    const installOptions = readSkillInstallOptions(metadata);
    return installOptions
        .flatMap((option) => {
            if (!option.bins.some((bin) => missingBins.has(bin))) {
                return [];
            }
            if (option.kind !== 'brew' || !option.formula) {
                return [];
            }

            return [
                {
                    bins: option.bins,
                    command: `brew install ${option.formula}`,
                    id: option.id,
                    label: option.label,
                },
            ];
        })
        .filter(
            (command, index, commands) =>
                commands.findIndex((candidate) => candidate.command === command.command) === index
        );
}

function resolveAssignedAgentAvatar(input: {
    agent: Awaited<ReturnType<typeof listAgents>>[number] | undefined;
    fallback: string;
}) {
    return input.agent?.emoji ?? input.agent?.avatar ?? initials(input.fallback);
}

function initials(value: string) {
    const result = value
        .split(/[^a-zA-Z0-9]+/u)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('');

    return result || '?';
}

function resolveSelectionDependencyState(
    selection: Awaited<ReturnType<typeof listAllAgentSkillSelections>>[number]
): SkillDetail['dependencyState'] {
    if (selection.syncError) {
        return 'missing';
    }

    const observed = parseObservedSkill(selection.observedJson);
    if (!observed) {
        return 'unknown';
    }

    if (observed.eligible === false || hasRequirements(observed.missing)) {
        return 'missing';
    }

    return observed.eligible === true ? 'ready' : 'unknown';
}

function hasRequirements(requirements: ReturnType<typeof emptyRequirements>) {
    return (
        requirements.anyBins.length > 0 ||
        requirements.bins.length > 0 ||
        requirements.config.length > 0 ||
        requirements.env.length > 0 ||
        requirements.os.length > 0
    );
}

function emptyRequirements() {
    return {
        anyBins: [] as string[],
        bins: [] as string[],
        config: [] as string[],
        env: [] as string[],
        os: [] as string[],
    };
}

function readRecord(value: unknown) {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;
}

function parseProjectionSkillIds(agent: Awaited<ReturnType<typeof getAgentProjection>>) {
    if (!agent) {
        return [];
    }
    try {
        const value = JSON.parse(agent.enabledSkillIdsJson) as unknown;
        return Array.isArray(value)
            ? value.filter((item): item is string => typeof item === 'string')
            : [];
    } catch {
        return [];
    }
}

function parseFiles(value: string): AgentRuntimeSkillFile[] {
    try {
        const files = JSON.parse(value) as AgentRuntimeSkillFile[];
        return Array.isArray(files) ? files : [];
    } catch {
        return [];
    }
}

function parseInstallSource(value: string) {
    try {
        return JSON.parse(value) as SkillDetail['installSource'];
    } catch {
        return null;
    }
}

async function listSkillSecretStatuses(skillPackage: SkillPackageRecord) {
    return await Promise.all(
        readSkillSecretEnvNames(parseSkillPackageMetadata(skillPackage)).map(async (envName) => {
            const record = await getTavernVaultSecret({
                id: getSkillEnvSecretId({
                    envName,
                    skillPackageId: skillPackage.id,
                }),
                schema: skillSecretValueSchema,
            });

            return {
                configured: Boolean(record),
                envName,
                updatedAt: record?.updatedAt ?? null,
            };
        })
    );
}

async function requireSkillPackage(skillId: string) {
    const skillPackage = await getSkillPackage(skillId);
    if (!skillPackage) {
        throw new Error('Skill not found.');
    }
    return skillPackage;
}

function validateSkillSecretEnvName(input: { envName: string; skillPackage: SkillPackageRecord }) {
    const envNames = readSkillSecretEnvNames(parseSkillPackageMetadata(input.skillPackage));
    if (!envNames.includes(input.envName)) {
        throw new Error(`Skill does not declare ${input.envName} as a required environment value.`);
    }
}

function parseSkillPackageMetadata(skillPackage: SkillPackageRecord) {
    try {
        const value = JSON.parse(skillPackage.metadataJson) as unknown;
        return readRecord(value);
    } catch {
        return null;
    }
}

async function readSkillMarkdown(cachePath: string) {
    for (const candidate of ['SKILL.md', 'skill.md', 'skills.md', 'SKILL.MD']) {
        try {
            return await fs.readFile(path.join(cachePath, candidate), 'utf8');
        } catch {
            // Try the next candidate.
        }
    }

    return '';
}
