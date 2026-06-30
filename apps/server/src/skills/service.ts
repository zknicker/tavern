import type { AgentRuntimeSkillSummary } from '@tavern/api';
import type { TavernAgentRuntimeClient } from '../agent-runtime/client.ts';
import { listAgentRuntimePlugins } from '../agent-runtime/plugins.ts';
import {
    getAgentRuntimeSkill,
    listAgentRuntimeSkills,
    setAgentRuntimeSkillEnabled,
} from '../agent-runtime/skills.ts';
import { listAgentRuntimeTools, setAgentRuntimeToolEnabled } from '../agent-runtime/tools.ts';
import { emitSkillInvalidationCascade } from '../api/invalidation-events.ts';
import { getActiveAgentRuntimeConnection } from '../storage/agent-runtime-connections.ts';
import {
    type SkillList,
    type SkillSummary,
    setSkillEnabledInputSchema,
    setToolEnabledInputSchema,
    skillIdSchema,
    skillListSchema,
    skillSummarySchema,
    type ToolSummary,
} from './contracts.ts';
import {
    enqueueRuntimeSkillInventoryRefresh,
    enqueueRuntimeSkillInventoryRefreshIfStale,
} from './inventory-job.ts';
import { getCachedRuntimeSkillInventory, refreshRuntimeSkillInventory } from './inventory-sync.ts';
import {
    listMissingPluginTools,
    rejectPluginSkillEnablement,
    rejectPluginToolEnablement,
    resolveSkillPlugin,
    resolveToolPlugin,
    type SkillPluginRef,
} from './plugin-capabilities.ts';

export async function listSkills(): Promise<SkillList> {
    const [runtime, tools, plugins] = await Promise.all([
        getActiveAgentRuntimeConnection(),
        listAgentRuntimeTools().catch(() => []),
        listAgentRuntimePlugins().catch(() => []),
    ]);
    const skillRuntimeId = getSkillInventoryRuntimeId(runtime);
    const runtimeTools = tools ?? [];
    const runtimePlugins = plugins ?? [];
    const cachedInventory = skillRuntimeId
        ? await getCachedRuntimeSkillInventory(skillRuntimeId).catch(() => null)
        : null;

    void enqueueRuntimeSkillInventoryRefreshIfStale(skillRuntimeId).catch(() => undefined);

    return skillListSchema.parse({
        skills: filterRuntimeVisibleSkills(cachedInventory?.skills ?? []).map((skill) =>
            buildSkillSummary(skill, runtimePlugins)
        ),
        tools: [
            ...runtimeTools,
            ...listMissingPluginTools(runtimePlugins, new Set(runtimeTools.map((tool) => tool.id))),
        ].map((tool) => buildToolSummary(tool, runtimePlugins)),
    });
}

export async function getSkill(input: unknown) {
    const parsed = skillIdSchema.parse(input);
    const skill = await getAgentRuntimeSkill(parsed);
    if (!skill) {
        throw new Error('Runtime skill details are unavailable.');
    }
    return skill;
}

export async function setSkillEnabled(input: unknown): Promise<SkillList> {
    const parsed = setSkillEnabledInputSchema.parse(input);
    const runtime = await getActiveAgentRuntimeConnection();
    const skillRuntimeId = getSkillInventoryRuntimeId(runtime);
    const cachedInventory = skillRuntimeId
        ? await getCachedRuntimeSkillInventory(skillRuntimeId).catch(() => null)
        : null;
    const skill = cachedInventory?.skills.find((candidate) => candidate.id === parsed.skillId);
    rejectPluginSkillEnablement(skill ?? parsed.skillId);
    const updated = await setAgentRuntimeSkillEnabled(parsed.skillId, { enabled: parsed.enabled });
    if (!updated) {
        throw new Error('Runtime skill enablement is unavailable.');
    }

    await refreshRuntimeSkillInventory().catch(async () => {
        await enqueueRuntimeSkillInventoryRefresh().catch(() => undefined);
    });
    emitSkillInvalidationCascade();

    return await listSkills();
}

export async function setToolEnabled(input: unknown): Promise<SkillList> {
    const parsed = setToolEnabledInputSchema.parse(input);
    rejectPluginToolEnablement(parsed.toolId);
    const updated = await setAgentRuntimeToolEnabled(parsed.toolId, {
        enabled: parsed.enabled,
    });
    if (!updated) {
        throw new Error('Runtime tool enablement is unavailable.');
    }

    emitSkillInvalidationCascade();

    return await listSkills();
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

function buildSkillSummary(
    skill: AgentRuntimeSkillSummary,
    plugins: Awaited<ReturnType<typeof listAgentRuntimePlugins>>
) {
    const plugin = resolveSkillPlugin(skill, plugins ?? []);
    const dependencyState = resolveDependencyState(skill);
    const enabled = plugin ? plugin.enabled : isSkillEnabled(skill);
    const usability = resolveSkillUsability({ dependencyState, enabled });

    return skillSummarySchema.parse({
        allowedTools: skill.allowedTools,
        diagnostic: buildSkillDiagnostic(skill, dependencyState, plugin),
        dependencyState,
        description: skill.description,
        enabled,
        id: skill.id,
        missing: skill.missing,
        name: skill.name,
        plugin,
        readOnly: plugin !== null,
        surface: resolveSkillSurface(),
        updatedAt: skill.updatedAt,
        usability,
        version: null,
    });
}

function resolveSkillSurface(): SkillSummary['surface'] {
    return 'agent';
}

function buildToolSummary(
    tool: {
        configured: boolean;
        description: null | string;
        enabled: boolean;
        id: string;
        label: string;
        placeholder?: boolean;
        readOnly?: boolean;
        tools: string[];
    },
    plugins: Awaited<ReturnType<typeof listAgentRuntimePlugins>>
): ToolSummary {
    const plugin = resolveToolPlugin({ ...tool, name: tool.label }, plugins ?? []);
    const enabled = plugin ? plugin.enabled : tool.enabled;
    const diagnostic = resolveToolDiagnostic({ enabled, plugin, tool });
    return {
        configured: tool.configured,
        description: tool.description,
        diagnostic,
        enabled,
        id: tool.id,
        name: tool.label,
        plugin,
        readOnly: tool.readOnly ?? false,
        tools: tool.tools,
        usability: diagnostic ? 'not_usable' : enabled ? 'enabled' : 'disabled',
    };
}

function resolveToolDiagnostic(input: {
    enabled: boolean;
    plugin: SkillPluginRef | null;
    tool: { configured: boolean; placeholder?: boolean };
}) {
    if (input.plugin && !input.plugin.enabled) {
        return `Enable ${input.plugin.displayName} in Plugins.`;
    }
    if (input.plugin && 'placeholder' in input.tool) {
        return `Restart the agent engine to load ${input.plugin.displayName} tools.`;
    }
    if (input.enabled && !input.tool.configured) {
        return input.plugin
            ? `Finish ${input.plugin.displayName} setup in Plugins.`
            : 'Required provider keys are missing.';
    }
    return null;
}

function resolveSkillUsability(input: {
    dependencyState: SkillSummary['dependencyState'];
    enabled: boolean;
}): SkillSummary['usability'] {
    if (!input.enabled) {
        return 'disabled';
    }
    if (input.dependencyState === 'missing') {
        return 'not_usable';
    }
    return 'enabled';
}

function isSkillEnabled(skill: AgentRuntimeSkillSummary) {
    return skill.disabled !== true && skill.userInvocable !== false;
}

function buildSkillDiagnostic(
    skill: AgentRuntimeSkillSummary,
    dependencyState: SkillSummary['dependencyState'],
    plugin: SkillPluginRef | null
) {
    if (plugin && !plugin.enabled) {
        return `Enable ${plugin.displayName} in Plugins.`;
    }
    if (dependencyState !== 'missing') {
        return null;
    }
    return formatMissingRequirements(skill.missing) ?? 'Required runtime setup is missing.';
}

function resolveDependencyState(skill: AgentRuntimeSkillSummary): SkillSummary['dependencyState'] {
    if (skill.eligible === false || hasRequirements(skill.missing)) {
        return 'missing';
    }

    return 'ready';
}

function hasRequirements(requirements: SkillSummary['missing']) {
    return (
        requirements.anyBins.length > 0 ||
        requirements.bins.length > 0 ||
        requirements.config.length > 0 ||
        requirements.env.length > 0 ||
        requirements.os.length > 0
    );
}

function formatMissingRequirements(requirements: SkillSummary['missing']) {
    const missing = [
        ...requirements.bins.map((value) => `bin ${value}`),
        ...requirements.anyBins.map((value) => `any bin ${value}`),
        ...requirements.env.map((value) => `env ${value}`),
        ...requirements.config.map((value) => `config ${value}`),
        ...requirements.os.map((value) => `os ${value}`),
    ];

    return missing.length > 0 ? `Missing ${missing.join(', ')}` : null;
}
