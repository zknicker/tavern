import { publishRuntimeEvent } from '../tavern/runtime-events.ts';

export function publishSkillUpdated(skillId: string) {
    publishRuntimeEvent({
        skillId,
        timestamp: new Date().toISOString(),
        type: 'skill.updated',
    });
}

export function publishSkillDeleted(skillId: string) {
    publishRuntimeEvent({
        skillId,
        timestamp: new Date().toISOString(),
        type: 'skill.deleted',
    });
}
