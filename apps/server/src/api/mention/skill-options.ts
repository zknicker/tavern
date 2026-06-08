import { listAgentRuntimeSkills } from '../../agent-runtime/skills.ts';
import type { MentionOptionResult } from './contracts.ts';

export type RuntimeSkillList = Awaited<ReturnType<typeof listAgentRuntimeSkills>>;

export async function listRuntimeSkillMentionOptions({
    agentId,
    runtimeSkills,
}: {
    agentId?: string;
    runtimeSkills?: RuntimeSkillList;
}) {
    const skills =
        runtimeSkills ?? (await listAgentRuntimeSkills(undefined, undefined, { agentId }));

    return (skills ?? [])
        .filter((skill) => skill.disabled !== true)
        .filter((skill) => skill.eligible !== false)
        .filter((skill) => skill.userInvocable !== false)
        .map((skill) => {
            const label = formatSkillDisplayName(skill.name);

            return {
                description: skill.description,
                id: skill.filePath ?? skill.id,
                insertText: skill.name,
                kind: 'skill',
                label,
                metadata: {
                    skillName: skill.name,
                    ...(skill.filePath ? { skillPath: skill.filePath } : {}),
                },
                projection: 'skill-context',
                sourceLabel:
                    skill.runtimeSource ?? (skill.source === 'builtin' ? 'Built-in' : 'Installed'),
            } satisfies MentionOptionResult;
        });
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
