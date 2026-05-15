function dedupeSkillIds(skillIds: string[] | null | undefined) {
    if (!skillIds) {
        return [];
    }

    const seen = new Set<string>();

    return skillIds.filter((skillId) => {
        if (seen.has(skillId)) {
            return false;
        }

        seen.add(skillId);
        return true;
    });
}

function toSkillIdSet(skillIds: string[]) {
    return new Set(dedupeSkillIds(skillIds));
}

export function resolveEnabledSkillIds(
    enabledSkillIds: string[] | null,
    availableSkillIds: string[]
) {
    if (enabledSkillIds === null) {
        return [];
    }

    const available = toSkillIdSet(availableSkillIds);

    return dedupeSkillIds(enabledSkillIds).filter((skillId) => available.has(skillId));
}

export function findMissingEnabledSkillIds(
    enabledSkillIds: string[] | null,
    availableSkillIds: string[]
) {
    if (enabledSkillIds === null) {
        return [];
    }

    const available = toSkillIdSet(availableSkillIds);
    return dedupeSkillIds(enabledSkillIds).filter((skillId) => !available.has(skillId));
}

export function normalizeEnabledSkillIds(
    enabledSkillIds: string[] | null,
    availableSkillIds: string[]
) {
    if (enabledSkillIds === null) {
        return [];
    }

    const resolved = resolveEnabledSkillIds(enabledSkillIds, availableSkillIds);
    const available = dedupeSkillIds(availableSkillIds);

    if (resolved.length !== available.length) {
        return resolved;
    }

    const resolvedSet = toSkillIdSet(resolved);
    return available.every((skillId) => resolvedSet.has(skillId)) ? null : resolved;
}
