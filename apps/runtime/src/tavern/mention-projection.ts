import {
    parseAgentReferenceTarget,
    parseSkillReferenceTarget,
    parseTavernRichReferences,
} from '@tavern/api/rich-references';

// Agent ids mentioned as [Name](agent://<agentId>) references, in order of
// first appearance. Shared by mention dispatch and chat_send steering.
export function readMentionedAgentIds(content: string) {
    const ids: string[] = [];
    for (const reference of parseTavernRichReferences(content)) {
        if (reference.kind !== 'agent') {
            continue;
        }
        const agentId = parseAgentReferenceTarget(reference.id);
        if (agentId && !ids.includes(agentId)) {
            ids.push(agentId);
        }
    }
    return ids;
}

export function projectTavernMessageForAgent(input: {
    content: string;
    enabledSkillIds: readonly string[];
}) {
    const skillIds = resolveActiveReferencedSkillIds(input);
    if (skillIds.length === 0) {
        return input.content;
    }

    return [
        '<skill_reference_context>',
        'The user explicitly referenced these enabled skills for this turn. Use the normal runtime skill-loading mechanism for them:',
        '',
        ...skillIds.map((skillId) => `- ${skillId}`),
        '</skill_reference_context>',
        '',
        input.content,
    ]
        .join('\n')
        .trim();
}

function resolveActiveReferencedSkillIds(input: {
    content: string;
    enabledSkillIds: readonly string[];
}) {
    const enabledSkillIds = new Set(input.enabledSkillIds);
    const seen = new Set<string>();
    const skillIds: string[] = [];

    for (const reference of parseTavernRichReferences(input.content)) {
        if (reference.kind !== 'skill' || reference.projection !== 'skill-activation') {
            continue;
        }

        const skillId = parseSkillReferenceTarget(reference.id);
        if (!(skillId && enabledSkillIds.has(skillId)) || seen.has(skillId)) {
            continue;
        }

        seen.add(skillId);
        skillIds.push(skillId);
    }

    return skillIds;
}
