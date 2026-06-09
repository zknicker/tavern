import type { AgentRuntimeSkillSummary } from '@tavern/api';
import type { TavernAgentRuntimeClient } from '../agent-runtime/client.ts';
import { listAgentRuntimeSkills, setAgentRuntimeSkillEnabled } from '../agent-runtime/skills.ts';
import {
    listAgentRuntimeToolsets,
    setAgentRuntimeToolsetEnabled,
} from '../agent-runtime/toolsets.ts';
import { emitSkillInvalidationCascade } from '../api/invalidation-events.ts';
import { getActiveAgentRuntimeConnection } from '../storage/agent-runtime-connections.ts';
import {
    type SkillList,
    type SkillSummary,
    setSkillEnabledInputSchema,
    setToolsetEnabledInputSchema,
    skillListSchema,
    skillSummarySchema,
    type ToolsetSummary,
} from './contracts.ts';
import {
    enqueueRuntimeSkillInventoryRefresh,
    enqueueRuntimeSkillInventoryRefreshIfStale,
} from './inventory-job.ts';
import { getCachedRuntimeSkillInventory, refreshRuntimeSkillInventory } from './inventory-sync.ts';

export async function listSkills(): Promise<SkillList> {
    const [runtime, toolsets] = await Promise.all([
        getActiveAgentRuntimeConnection(),
        listAgentRuntimeToolsets().catch(() => []),
    ]);
    const skillRuntimeId = getSkillInventoryRuntimeId(runtime);
    const runtimeToolsets = toolsets ?? [];
    const cachedInventory = skillRuntimeId
        ? await getCachedRuntimeSkillInventory(skillRuntimeId).catch(() => null)
        : null;

    void enqueueRuntimeSkillInventoryRefreshIfStale(skillRuntimeId).catch(() => undefined);

    return skillListSchema.parse({
        skills: filterRuntimeVisibleSkills(cachedInventory?.skills ?? []).map((skill) =>
            buildSkillSummary(skill)
        ),
        toolsets: runtimeToolsets.map(buildToolsetSummary),
    });
}

export async function setSkillEnabled(input: unknown): Promise<SkillList> {
    const parsed = setSkillEnabledInputSchema.parse(input);
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

export async function setToolsetEnabled(input: unknown): Promise<SkillList> {
    const parsed = setToolsetEnabledInputSchema.parse(input);
    const updated = await setAgentRuntimeToolsetEnabled(parsed.toolsetId, {
        enabled: parsed.enabled,
    });
    if (!updated) {
        throw new Error('Runtime toolset enablement is unavailable.');
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

function buildSkillSummary(skill: AgentRuntimeSkillSummary) {
    const dependencyState = resolveDependencyState(skill);
    const enabled = isSkillEnabled(skill);
    const usability = resolveSkillUsability({ dependencyState, enabled });

    return skillSummarySchema.parse({
        allowedTools: skill.allowedTools,
        diagnostic: buildSkillDiagnostic(skill, dependencyState),
        dependencyState,
        description: skill.description,
        enabled,
        id: skill.id,
        missing: skill.missing,
        name: skill.name,
        surface: resolveSkillSurface(),
        updatedAt: skill.updatedAt,
        usability,
        version: null,
    });
}

function resolveSkillSurface(): SkillSummary['surface'] {
    return 'hermes';
}

function buildToolsetSummary(toolset: {
    configured: boolean;
    description: null | string;
    enabled: boolean;
    id: string;
    label: string;
    tools: string[];
}): ToolsetSummary {
    const diagnostic =
        toolset.enabled && !toolset.configured ? 'Required provider keys are missing.' : null;
    return {
        configured: toolset.configured,
        description: toolset.description,
        diagnostic,
        enabled: toolset.enabled,
        id: toolset.id,
        name: toolset.label,
        tools: toolset.tools,
        usability: diagnostic ? 'not_usable' : toolset.enabled ? 'enabled' : 'disabled',
    };
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
    dependencyState: SkillSummary['dependencyState']
) {
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
