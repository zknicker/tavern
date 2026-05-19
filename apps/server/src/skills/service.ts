import type { AgentRuntimeSkill, AgentRuntimeSkillSummary } from '@tavern/api';
import { z } from 'zod';
import type { TavernAgentRuntimeClient } from '../agent-runtime/client.ts';
import { getAgentRuntimeSkill, listAgentRuntimeSkills } from '../agent-runtime/skills.ts';
import { resolveAgentDefaultPrimaryColor } from '../agents/palette.ts';
import { emitSkillInvalidationCascade } from '../api/invalidation-events.ts';
import {
    applyCurrentOpenClawConfigFixups,
    getOpenClawConfigState,
} from '../openclaw-config/service.ts';
import { listAgents } from '../storage/agents.ts';
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
import { parseSkillMarkdown } from './markdown.ts';

const skillSecretValueSchema = z.object({
    value: z.string(),
});

export async function listSkills(): Promise<SkillList> {
    const [agents, configState, skills] = await Promise.all([
        listAgents({ includeInactive: true }),
        getOpenClawConfigState(),
        listAgentRuntimeSkills().catch(() => null),
    ]);
    const runtimeAgents = filterAgentsByRuntime({
        agents,
        runtimeId: configState.runtimeId,
    });

    return skillListSchema.parse({
        plugins: buildPluginSummaries(configState.snapshot?.config ?? null),
        skills: (skills ?? []).map((skill) => buildSkillSummary(skill, runtimeAgents)),
    });
}

export async function getSkill(input: unknown): Promise<{ skill: SkillDetail | null }> {
    const parsed = getSkillInputSchema.parse(input);
    const runtimeSkill = await getRuntimeSkill(parsed.skillId);

    if (!runtimeSkill) {
        return skillGetSchema.parse({ skill: null });
    }

    const [agents, configState, secrets] = await Promise.all([
        listAgents({ includeInactive: true }),
        getOpenClawConfigState(),
        listSkillSecretStatuses(runtimeSkill),
    ]);
    const runtimeAgents = filterAgentsByRuntime({
        agents,
        runtimeId: configState.runtimeId,
    });
    const metadata = parseSkillMarkdown({
        contentMarkdown: runtimeSkill.contentMarkdown,
        skillId: runtimeSkill.id,
    });
    const summary = buildSkillSummary(runtimeSkill, runtimeAgents);

    return skillGetSchema.parse({
        skill: {
            ...summary,
            allowedTools: metadata.allowedTools ?? runtimeSkill.allowedTools,
            assignedAgents: buildAssignedAgents({
                agents: runtimeAgents,
                skill: runtimeSkill,
            }),
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
    await applyCurrentOpenClawConfigFixups().catch(() => undefined);
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
    await applyCurrentOpenClawConfigFixups().catch(() => undefined);
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
    const [detail, skills] = await Promise.all([
        getAgentRuntimeSkill(skillId),
        listAgentRuntimeSkills(),
    ]);
    const summary = skills?.find((skill) => skill.id === skillId);

    if (detail) {
        return summary ? mergeRuntimeSkillDetail(detail, summary) : detail;
    }

    return summary ? toRuntimeSkill(summary) : null;
}

export function mergeRuntimeSkillDetail(
    detail: AgentRuntimeSkill,
    summary: AgentRuntimeSkillSummary
): AgentRuntimeSkill {
    return {
        ...detail,
        allowedTools: summary.allowedTools ?? detail.allowedTools,
        baseDir: summary.baseDir ?? detail.baseDir,
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

function buildSkillSummary(
    skill: AgentRuntimeSkillSummary,
    agents: Awaited<ReturnType<typeof listAgents>>
) {
    const dependencyState = resolveDependencyState(skill);
    const agentCount = countAssignedAgents({
        agents,
        skillId: skill.id,
    });
    const usability = resolveSkillUsability({
        agentCount,
        dependencyState,
    });

    return skillSummarySchema.parse({
        agentCount,
        allowedTools: skill.allowedTools,
        diagnostic: buildSkillDiagnostic(skill, dependencyState),
        dependencyState,
        description: skill.description,
        id: skill.id,
        missing: skill.missing,
        name: skill.name,
        updatedAt: skill.updatedAt,
        usability,
        version: null,
    });
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

function buildAssignedAgents(input: {
    agents: Awaited<ReturnType<typeof listAgents>>;
    skill: AgentRuntimeSkillSummary;
}): SkillDetail['assignedAgents'] {
    return input.agents
        .filter((agent) => parseProjectionSkillIds(agent).includes(input.skill.id))
        .map((agent) => ({
            agentId: agent.id,
            agentAvatar: resolveAssignedAgentAvatar({
                agent,
                fallback: agent.name,
            }),
            agentName: agent.name,
            agentPrimaryColor: agent.primaryColor ?? resolveAgentDefaultPrimaryColor(agent.id),
            baseDir: input.skill.baseDir ?? null,
            commandVisible: input.skill.commandVisible ?? null,
            configChecks: input.skill.configChecks,
            dependencyState: resolveDependencyState(input.skill),
            eligible: input.skill.eligible ?? null,
            missing: input.skill.missing,
            modelVisible: input.skill.modelVisible ?? null,
            requirements: input.skill.requirements,
            runtimeId: agent.runtimeId,
            syncError: null,
        }))
        .sort((left, right) => left.agentName.localeCompare(right.agentName));
}

function filterAgentsByRuntime(input: {
    agents: Awaited<ReturnType<typeof listAgents>>;
    runtimeId: null | string;
}) {
    return input.runtimeId
        ? input.agents.filter((agent) => agent.runtimeId === input.runtimeId)
        : input.agents;
}

function countAssignedAgents(input: {
    agents: Awaited<ReturnType<typeof listAgents>>;
    skillId: string;
}) {
    return input.agents.filter((agent) => parseProjectionSkillIds(agent).includes(input.skillId))
        .length;
}

function resolveSkillUsability(input: {
    agentCount: number;
    dependencyState: SkillDetail['dependencyState'];
}): SkillDetail['usability'] {
    if (input.dependencyState === 'missing') {
        return 'not_usable';
    }
    return input.agentCount > 0 ? 'enabled' : 'disabled';
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

function parseProjectionSkillIds(agent: Awaited<ReturnType<typeof listAgents>>[number]) {
    try {
        const value = JSON.parse(agent.enabledSkillIdsJson) as unknown;
        return Array.isArray(value)
            ? value.filter((item): item is string => typeof item === 'string')
            : [];
    } catch {
        return [];
    }
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
    return 'OpenClaw';
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
        return 'OpenClaw memory capabilities.';
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
