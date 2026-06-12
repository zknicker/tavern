import type { AgentRuntimeSkillHubActionResult } from '@tavern/api';
import {
    addAgentRuntimeSkillHubTap,
    getAgentRuntimeSkillHubCatalog,
    installAgentRuntimeSkillHubSkill,
    listAgentRuntimeSkillHubTaps,
    previewAgentRuntimeSkillHubSkill,
    removeAgentRuntimeSkillHubTap,
    scanAgentRuntimeSkillHubSkill,
    searchAgentRuntimeSkillHub,
    uninstallAgentRuntimeSkillHubSkill,
} from '../agent-runtime/skill-hub.ts';
import { emitSkillInvalidationCascade } from '../api/invalidation-events.ts';
import {
    skillHubIdentifierInputSchema,
    skillHubInstallInputSchema,
    skillHubSearchInputSchema,
    skillHubTapInputSchema,
    skillHubTapRemoveInputSchema,
    skillHubUninstallInputSchema,
} from './contracts.ts';
import { enqueueRuntimeSkillInventoryRefresh } from './inventory-job.ts';
import { refreshRuntimeSkillInventory } from './inventory-sync.ts';

export async function getSkillHubCatalog() {
    return requireHub(await getAgentRuntimeSkillHubCatalog());
}

export async function searchSkillHub(input: unknown) {
    const parsed = skillHubSearchInputSchema.parse(input);
    return requireHub(await searchAgentRuntimeSkillHub(parsed));
}

export async function previewSkillHubSkill(input: unknown) {
    const parsed = skillHubIdentifierInputSchema.parse(input);
    return requireHub(await previewAgentRuntimeSkillHubSkill(parsed.identifier));
}

export async function scanSkillHubSkill(input: unknown) {
    const parsed = skillHubIdentifierInputSchema.parse(input);
    return requireHub(await scanAgentRuntimeSkillHubSkill(parsed.identifier));
}

export async function installSkillHubSkill(input: unknown) {
    const parsed = skillHubInstallInputSchema.parse(input);
    const result = requireHub(await installAgentRuntimeSkillHubSkill(parsed));
    await applySkillInventoryChange();
    if (!result.ok) {
        throw new Error(formatActionFailure('Skill install failed', result));
    }
    return result;
}

export async function uninstallSkillHubSkill(input: unknown) {
    const parsed = skillHubUninstallInputSchema.parse(input);
    const result = requireHub(await uninstallAgentRuntimeSkillHubSkill(parsed));
    await applySkillInventoryChange();
    if (!result.ok) {
        throw new Error(formatActionFailure('Skill uninstall failed', result));
    }
    return result;
}

export async function listSkillHubTaps() {
    return requireHub(await listAgentRuntimeSkillHubTaps());
}

export async function addSkillHubTap(input: unknown) {
    const parsed = skillHubTapInputSchema.parse(input);
    const taps = requireHub(await addAgentRuntimeSkillHubTap(parsed));
    emitSkillInvalidationCascade();
    return taps;
}

export async function removeSkillHubTap(input: unknown) {
    const parsed = skillHubTapRemoveInputSchema.parse(input);
    const taps = requireHub(await removeAgentRuntimeSkillHubTap(parsed.repo));
    emitSkillInvalidationCascade();
    return taps;
}

function requireHub<Result>(result: Result | null): Result {
    if (result === null) {
        throw new Error('The skill catalog is unavailable while the runtime is offline.');
    }
    return result;
}

async function applySkillInventoryChange() {
    await refreshRuntimeSkillInventory().catch(async () => {
        await enqueueRuntimeSkillInventoryRefresh().catch(() => undefined);
    });
    emitSkillInvalidationCascade();
}

function formatActionFailure(label: string, result: AgentRuntimeSkillHubActionResult) {
    const tail = result.log
        .filter((line) => line.trim().length > 0)
        .slice(-4)
        .join(' ');
    return tail.length > 0 ? `${label}: ${tail}` : `${label}.`;
}
