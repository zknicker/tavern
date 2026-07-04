import { formatSkillReferenceTarget } from '@tavern/api/rich-references';
import { listAgentRuntimeSkills } from '../../agent-runtime/skills.ts';
import type { MentionOptionResult } from './contracts.ts';

export type RuntimeSkillList = Awaited<ReturnType<typeof listAgentRuntimeSkills>>;

export async function listRuntimeSkillMentionOptions({
    agentId,
    agentIds = agentId ? [agentId] : [],
    runtimeSkills,
}: {
    agentId?: string;
    agentIds?: readonly string[];
    runtimeSkills?: RuntimeSkillList;
}) {
    const skills = runtimeSkills ?? (await listMentionRuntimeSkills(agentIds));

    return (skills ?? []).filter(isMentionableRuntimeSkill).map((skill) => {
        const label = formatSkillDisplayName(skill.name);

        return {
            description: skill.description,
            id: formatSkillReferenceTarget(skill.id),
            insertText: skill.name,
            kind: 'skill',
            label,
            projection: 'skill-activation',
            sourceLabel:
                skill.runtimeSource ?? (skill.source === 'builtin' ? 'Built-in' : 'Installed'),
        } satisfies MentionOptionResult;
    });
}

async function listMentionRuntimeSkills(agentIds: readonly string[]) {
    if (agentIds.length === 0) {
        return await listAgentRuntimeSkills();
    }

    const skillLists = await Promise.all(
        agentIds.map((agentId) => listAgentRuntimeSkills(undefined, undefined, { agentId }))
    );
    return mergeMentionRuntimeSkillLists(skillLists);
}

export function mergeMentionRuntimeSkillLists(skillLists: readonly RuntimeSkillList[]) {
    const skills = new Map<string, NonNullable<RuntimeSkillList>[number]>();

    for (const skill of skillLists.flatMap((list) =>
        (list ?? []).filter(isMentionableRuntimeSkill)
    )) {
        if (!skills.has(skill.id)) {
            skills.set(skill.id, skill);
        }
    }

    return [...skills.values()];
}

function isMentionableRuntimeSkill(skill: NonNullable<RuntimeSkillList>[number]) {
    return skill.disabled !== true && skill.eligible !== false && skill.userInvocable !== false;
}

const acronymWords = new Set([
    'AI',
    'API',
    'CI',
    'CLI',
    'CSS',
    'GH',
    'GPU',
    'HTML',
    'JS',
    'LLM',
    'MCP',
    'PDF',
    'PR',
    'QA',
    'SQL',
    'TS',
    'UI',
    'URL',
    'UX',
]);

const productWords = new Map([
    ['datadog', 'DataDog'],
    ['fastapi', 'FastAPI'],
    ['github', 'GitHub'],
    ['openai', 'OpenAI'],
    ['openapi', 'OpenAPI'],
    ['pagerduty', 'PagerDuty'],
    ['sqlite', 'SQLite'],
]);

const lowercaseTitleWords = new Set(['and', 'or', 'to', 'up', 'with']);

function formatSkillDisplayName(name: string) {
    return name
        .replace(/[_-]+/g, ' ')
        .split(/\s+/u)
        .filter((word) => word.length > 0)
        .map((word, index) => formatSkillDisplayWord(word, index))
        .join(' ');
}

function formatSkillDisplayWord(word: string, index: number) {
    const acronym = formatAcronymWord(word);

    if (acronym) {
        return acronym;
    }

    const lower = word.toLowerCase();

    return (
        productWords.get(lower) ??
        (index > 0 && lowercaseTitleWords.has(lower) ? lower : titleCaseWord(lower))
    );
}

function formatAcronymWord(word: string) {
    const upper = word.toUpperCase();

    if (acronymWords.has(upper)) {
        return upper;
    }

    if (!word.toLowerCase().endsWith('s')) {
        return null;
    }

    const singular = word.slice(0, -1).toUpperCase();

    return acronymWords.has(singular) ? `${singular}s` : null;
}

function titleCaseWord(word: string) {
    return `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`;
}
