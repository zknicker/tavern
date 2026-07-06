import * as React from 'react';
import type { RuntimeManagedByName } from '../../features/skills/skill-tree-model.ts';
import { useRuntimeSkillList } from './use-runtime-skill-list.ts';

/**
 * Runtime-owned managed-skill flags (edited/updateAvailable/managedSource)
 * keyed by skill name, sourced from the runtime skill summary.
 */
export function useRuntimeManagedFlags(input: { agentId?: string } = {}): RuntimeManagedByName {
    const runtimeSkills = useRuntimeSkillList({ agentId: input.agentId });

    return React.useMemo(() => {
        const byName: RuntimeManagedByName = new Map();
        for (const skill of runtimeSkills.data?.skills ?? []) {
            byName.set(skill.name, {
                edited: skill.edited,
                managedSource: skill.managedSource ?? null,
                updateAvailable: skill.updateAvailable,
            });
        }
        return byName;
    }, [runtimeSkills.data?.skills]);
}
