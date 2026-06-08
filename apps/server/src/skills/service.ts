import type { AgentRuntimeSkill, AgentRuntimeSkillSummary } from '@tavern/api';
import { z } from 'zod';
import type { TavernAgentRuntimeClient } from '../agent-runtime/client.ts';
import { getAgentRuntimeSkill, listAgentRuntimeSkills } from '../agent-runtime/skills.ts';
import { emitSkillInvalidationCascade } from '../api/invalidation-events.ts';
import { applyCurrentHermesConfigFixups, getHermesConfigState } from '../hermes-config/service.ts';
import { getActiveAgentRuntimeConnection } from '../storage/agent-runtime-connections.ts';
import {
    deleteTavernVaultSecret,
    getSkillEnvSecretId,
    getTavernVaultSecret,
    saveTavernVaultSecret,
} from '../storage/tavern-vault.ts';
import {
    deleteSkillSecretInputSchema,
    getSkillInputSchema,
    type PluginSummary,
    type SkillDetail,
    type SkillList,
    saveSkillSecretInputSchema,
    skillGetSchema,
    skillListSchema,
    skillSummarySchema,
} from './contracts.ts';
import {
    enqueueRuntimeSkillInventoryRefresh,
    enqueueRuntimeSkillInventoryRefreshIfStale,
} from './inventory-job.ts';
import { getCachedRuntimeSkillInventory } from './inventory-sync.ts';
import { parseSkillMarkdown } from './markdown.ts';

const skillSecretValueSchema = z.object({
    value: z.string(),
});

export async function listSkills(): Promise<SkillList> {
    const [configState, runtime] = await Promise.all([
        getHermesConfigState(),
        getActiveAgentRuntimeConnection(),
    ]);
    const skillRuntimeId = getSkillInventoryRuntimeId(runtime);
    const cachedInventory = skillRuntimeId
        ? await getCachedRuntimeSkillInventory(skillRuntimeId).catch(() => null)
        : null;

    void enqueueRuntimeSkillInventoryRefreshIfStale(skillRuntimeId).catch(() => undefined);

    return skillListSchema.parse({
        plugins: buildPluginSummaries(configState.snapshot?.config ?? null),
        skills: filterRuntimeVisibleSkills(cachedInventory?.skills ?? []).map((skill) =>
            buildSkillSummary(skill)
        ),
    });
}

export async function getSkill(input: unknown): Promise<{ skill: SkillDetail | null }> {
    const parsed = getSkillInputSchema.parse(input);
    const runtimeSkill = await getRuntimeSkill(parsed.skillId);

    if (!(runtimeSkill && isRuntimeVisibleSkill(runtimeSkill))) {
        return skillGetSchema.parse({ skill: null });
    }

    const secrets = await listSkillSecretStatuses(runtimeSkill);
    const metadata = parseSkillMarkdown({
        contentMarkdown: runtimeSkill.contentMarkdown,
        skillId: runtimeSkill.id,
    });
    const summary = buildSkillSummary(runtimeSkill);

    return skillGetSchema.parse({
        skill: {
            ...summary,
            allowedTools: metadata.allowedTools ?? runtimeSkill.allowedTools,
            bodyMarkdown: metadata.bodyMarkdown,
            contentMarkdown: runtimeSkill.contentMarkdown,
            files: runtimeSkill.files,
            install: runtimeSkill.install,
            installSource: runtimeSkill.installSource,
            license: metadata.license,
            metadata: metadata.metadata,
            requirements: runtimeSkill.requirements,
            secrets,
            setupCommands: [],
        },
    });
}

export async function saveSkillSecret(input: unknown) {
    const parsed = saveSkillSecretInputSchema.parse(input);
    const skill = await requireRuntimeSkill(parsed.skillId);
    validateSkillSecretEnvName({
        envName: parsed.envName,
        skill,
    });

    await saveTavernVaultSecret({
        id: getSkillEnvSecretId({
            envName: parsed.envName,
            skillPackageId: skill.id,
        }),
        secret: {
            value: parsed.value,
        },
    });
    await applyCurrentHermesConfigFixups().catch(() => undefined);
    void enqueueRuntimeSkillInventoryRefresh().catch(() => undefined);
    emitSkillInvalidationCascade();

    return await getSkill({ skillId: skill.id });
}

export async function deleteSkillSecret(input: unknown) {
    const parsed = deleteSkillSecretInputSchema.parse(input);
    const skill = await requireRuntimeSkill(parsed.skillId);
    validateSkillSecretEnvName({
        envName: parsed.envName,
        skill,
    });

    await deleteTavernVaultSecret(
        getSkillEnvSecretId({
            envName: parsed.envName,
            skillPackageId: skill.id,
        })
    );
    await applyCurrentHermesConfigFixups().catch(() => undefined);
    void enqueueRuntimeSkillInventoryRefresh().catch(() => undefined);
    emitSkillInvalidationCascade();

    return await getSkill({ skillId: skill.id });
}

export async function listSkillIds(input?: {
    agentId?: string;
    client?: TavernAgentRuntimeClient | null;
    runtimeId?: string | null;
}) {
    const skills =
        (await listAgentRuntimeSkills(input?.client, input?.runtimeId, {
            agentId: input?.agentId,
        })) ?? [];
    return skills.map((skill) => skill.id);
}

async function getRuntimeSkill(skillId: string) {
    const runtime = await getActiveAgentRuntimeConnection();
    const skillRuntimeId = getSkillInventoryRuntimeId(runtime);
    const [detail, cachedInventory] = await Promise.all([
        getAgentRuntimeSkill(skillId),
        skillRuntimeId ? getCachedRuntimeSkillInventory(skillRuntimeId).catch(() => null) : null,
    ]);
    const summary = cachedInventory?.skills.find((skill) => skill.id === skillId);

    if (detail) {
        return summary ? mergeRuntimeSkillDetail(detail, summary) : detail;
    }

    return summary ? toRuntimeSkill(summary) : null;
}

function getSkillInventoryRuntimeId(
    runtime: Awaited<ReturnType<typeof getActiveAgentRuntimeConnection>>
) {
    if (!(runtime?.enabled && runtime.lastCheckedAt)) {
        return null;
    }

    return runtime.id;
}

export function filterRuntimeVisibleSkills(skills: AgentRuntimeSkillSummary[]) {
    return skills.filter((skill) => isRuntimeVisibleSkill(skill));
}

function isRuntimeVisibleSkill(skill: AgentRuntimeSkillSummary) {
    return skill.blockedByAllowlist !== true;
}

export function mergeRuntimeSkillDetail(
    detail: AgentRuntimeSkill,
    summary: AgentRuntimeSkillSummary
): AgentRuntimeSkill {
    return {
        ...detail,
        allowedTools: summary.allowedTools ?? detail.allowedTools,
        baseDir: summary.baseDir ?? detail.baseDir,
        blockedByAllowlist: summary.blockedByAllowlist ?? detail.blockedByAllowlist,
        bundled: summary.bundled ?? detail.bundled,
        commandVisible: summary.commandVisible ?? detail.commandVisible,
        configChecks: summary.configChecks,
        description: summary.description ?? detail.description,
        disabled: summary.disabled ?? detail.disabled,
        eligible: summary.eligible ?? detail.eligible,
        filePath: summary.filePath ?? detail.filePath,
        install: summary.install,
        missing: summary.missing,
        modelVisible: summary.modelVisible ?? detail.modelVisible,
        name: summary.name,
        primaryEnv: summary.primaryEnv ?? detail.primaryEnv,
        requirements: summary.requirements,
        runtimeSource: summary.runtimeSource ?? detail.runtimeSource,
        skillKey: summary.skillKey ?? detail.skillKey,
        source: summary.source,
        updatedAt: summary.updatedAt ?? detail.updatedAt,
        userInvocable: summary.userInvocable ?? detail.userInvocable,
    };
}

async function requireRuntimeSkill(skillId: string) {
    const skill = await getRuntimeSkill(skillId);
    if (!skill) {
        throw new Error('Skill not found.');
    }
    return skill;
}

function buildSkillSummary(skill: AgentRuntimeSkillSummary) {
    const dependencyState = resolveDependencyState(skill);
    const usability = resolveSkillUsability(dependencyState);

    return skillSummarySchema.parse({
        allowedTools: skill.allowedTools,
        diagnostic: buildSkillDiagnostic(skill, dependencyState),
        dependencyState,
        description: skill.description,
        id: skill.id,
        missing: skill.missing,
        name: skill.name,
        surface: resolveSkillSurface(skill),
        updatedAt: skill.updatedAt,
        usability,
        version: null,
    });
}

function resolveSkillSurface(skill: AgentRuntimeSkillSummary): SkillDetail['surface'] {
    return skill.runtimeSource?.toLowerCase().includes('codex') ? 'codex' : 'hermes';
}

export function buildPluginSummaries(config: null | Record<string, unknown>): PluginSummary[] {
    const plugins = readRecord(config?.plugins);
    const entries = readRecord(plugins.entries);
    const disabledGlobally = plugins.enabled === false;
    const allow = new Set(readStringArray(plugins.allow));
    const deny = new Set(readStringArray(plugins.deny));
    const channelPluginIds = collectConfiguredChannelPluginIds(config);
    const ids = new Set([...Object.keys(entries), ...allow]);

    return [...ids]
        .filter((id) => shouldShowPlugin({ channelPluginIds, id }))
        .sort((left, right) => left.localeCompare(right))
        .flatMap((id) => {
            const entry = readRecord(entries[id]);
            const enabled = !disabledGlobally && entry.enabled !== false && !deny.has(id);
            const summary = buildPluginSummary({
                enabled,
                entry,
                id,
                missingEntry: Object.keys(entries).length > 0 && !(id in entries),
            });
            return summary ? [summary] : [];
        });
}

function buildPluginSummary(input: {
    enabled: boolean;
    entry: Record<string, unknown>;
    id: string;
    missingEntry: boolean;
}): PluginSummary | null {
    const name = readString(input.entry.name) ?? formatPluginName(input.id);
    const source = resolvePluginSource(input.id, input.entry);
    const description = resolvePluginDescription(input.id, input.entry);
    const notUsableReason = input.missingEntry
        ? 'Plugin is allowed, but no configured plugin entry was found.'
        : null;

    return {
        description,
        diagnostic: notUsableReason,
        enabled: input.enabled && !notUsableReason,
        id: input.id,
        name,
        source,
        updatedAt: null,
        usability: notUsableReason ? 'not_usable' : input.enabled ? 'enabled' : 'disabled',
    };
}

function resolveSkillUsability(
    dependencyState: SkillDetail['dependencyState']
): SkillDetail['usability'] {
    if (dependencyState === 'missing') {
        return 'not_usable';
    }
    return 'enabled';
}

function buildSkillDiagnostic(
    skill: AgentRuntimeSkillSummary,
    dependencyState: SkillDetail['dependencyState']
) {
    if (dependencyState !== 'missing') {
        return null;
    }
    return formatMissingRequirements(skill.missing) ?? 'Required runtime setup is missing.';
}

function resolveDependencyState(skill: AgentRuntimeSkillSummary): SkillDetail['dependencyState'] {
    if (skill.eligible === false || hasRequirements(skill.missing)) {
        return 'missing';
    }

    return skill.eligible === true ? 'ready' : 'unknown';
}

function hasRequirements(requirements: SkillDetail['missing']) {
    return (
        requirements.anyBins.length > 0 ||
        requirements.bins.length > 0 ||
        requirements.config.length > 0 ||
        requirements.env.length > 0 ||
        requirements.os.length > 0
    );
}

function formatMissingRequirements(requirements: SkillDetail['missing']) {
    const missing = [
        ...requirements.bins.map((value) => `bin ${value}`),
        ...requirements.anyBins.map((value) => `any bin ${value}`),
        ...requirements.env.map((value) => `env ${value}`),
        ...requirements.config.map((value) => `config ${value}`),
        ...requirements.os.map((value) => `os ${value}`),
    ];

    return missing.length > 0 ? `Missing ${missing.join(', ')}` : null;
}

function toRuntimeSkill(summary: AgentRuntimeSkillSummary): AgentRuntimeSkill {
    return {
        ...summary,
        contentMarkdown: '',
        files: [],
        installSource: null,
    };
}

function shouldShowPlugin(input: { channelPluginIds: Set<string>; id: string }) {
    if (input.channelPluginIds.has(input.id)) {
        return false;
    }
    return input.id !== 'tavern';
}

function collectConfiguredChannelPluginIds(config: null | Record<string, unknown>) {
    const channels = readRecord(config?.channels);
    return new Set(Object.keys(channels));
}

function resolvePluginSource(id: string, entry: Record<string, unknown>) {
    const rawSource = readString(entry.source);
    if (rawSource) {
        return rawSource;
    }
    if (id === 'codex' || hasCodexNativePlugins(entry) || hasCodexComputerUse(entry)) {
        return 'Codex';
    }
    return 'Hermes';
}

function resolvePluginDescription(id: string, entry: Record<string, unknown>) {
    const rawDescription = readString(entry.description);
    if (rawDescription) {
        return rawDescription;
    }
    if (id === 'codex') {
        const features = [
            hasCodexNativePlugins(entry) ? 'native Codex plugins' : null,
            hasCodexComputerUse(entry) ? 'Computer Use' : null,
        ].filter(Boolean);

        return features.length > 0
            ? `Codex harness with ${features.join(' and ')}.`
            : 'Codex app-server harness and Codex-managed model access.';
    }
    if (id === 'memory-core') {
        return 'Hermes memory capabilities.';
    }
    if (id === 'openai') {
        return 'OpenAI model and media provider capabilities.';
    }
    return null;
}

function hasCodexNativePlugins(entry: Record<string, unknown>) {
    const config = readRecord(entry.config);
    const codexPlugins = readRecord(config.codexPlugins);
    return (
        codexPlugins.enabled === true || Object.keys(readRecord(codexPlugins.plugins)).length > 0
    );
}

function hasCodexComputerUse(entry: Record<string, unknown>) {
    const config = readRecord(entry.config);
    const computerUse = readRecord(config.computerUse);
    return computerUse.enabled === true || Object.keys(computerUse).length > 0;
}

function formatPluginName(id: string) {
    return id
        .split(/[-_]+/u)
        .filter(Boolean)
        .map((part) => part[0]?.toUpperCase() + part.slice(1))
        .join(' ');
}

function readRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
}

function readString(value: unknown) {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function readStringArray(value: unknown) {
    return Array.isArray(value)
        ? value.filter((item): item is string => typeof item === 'string' && item.length > 0)
        : [];
}

async function listSkillSecretStatuses(skill: AgentRuntimeSkillSummary) {
    return await Promise.all(
        skill.requirements.env.map(async (envName) => {
            const record = await getTavernVaultSecret({
                id: getSkillEnvSecretId({
                    envName,
                    skillPackageId: skill.id,
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

function validateSkillSecretEnvName(input: { envName: string; skill: AgentRuntimeSkillSummary }) {
    if (!input.skill.requirements.env.includes(input.envName)) {
        throw new Error(`Skill does not declare ${input.envName} as a required environment value.`);
    }
}
