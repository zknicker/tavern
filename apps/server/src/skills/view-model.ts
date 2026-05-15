import type { AgentRuntimeSkillSummary } from '@tavern/agent-runtime-protocol';
import type { AgentSkillSelectionRecord } from './storage.ts';

export function resolveDependencyState(selections: AgentSkillSelectionRecord[]) {
    if (selections.length === 0 || selections.every((selection) => !selection.observedJson)) {
        return 'unknown';
    }
    if (selections.some((selection) => selection.syncError)) {
        return 'missing';
    }
    return 'ready';
}

export function aggregateRequirements(
    selections: AgentSkillSelectionRecord[],
    field: 'missing' | 'requirements'
) {
    const result = {
        anyBins: [] as string[],
        bins: [] as string[],
        config: [] as string[],
        env: [] as string[],
        os: [] as string[],
    };

    for (const selection of selections) {
        const observed = parseObservedSkill(selection.observedJson);
        const requirements = observed?.[field];
        if (!requirements) {
            continue;
        }
        for (const key of Object.keys(result) as Array<keyof typeof result>) {
            result[key] = [...new Set([...result[key], ...requirements[key]])];
        }
    }

    return result;
}

export function aggregateInstallOptions(selections: AgentSkillSelectionRecord[]) {
    const seen = new Set<string>();
    const install: AgentRuntimeSkillSummary['install'] = [];
    for (const selection of selections) {
        const observed = parseObservedSkill(selection.observedJson);
        for (const option of observed?.install ?? []) {
            if (seen.has(option.id)) {
                continue;
            }
            seen.add(option.id);
            install.push(option);
        }
    }
    return install;
}

export function parseObservedSkill(value: string | null): AgentRuntimeSkillSummary | null {
    if (!value) {
        return null;
    }
    try {
        return JSON.parse(value) as AgentRuntimeSkillSummary;
    } catch {
        return null;
    }
}

export function groupSelectionsByPackage(selections: AgentSkillSelectionRecord[]) {
    const groups = new Map<string, AgentSkillSelectionRecord[]>();
    for (const selection of selections) {
        groups.set(selection.skillPackageId, [
            ...(groups.get(selection.skillPackageId) ?? []),
            selection,
        ]);
    }
    return groups;
}
