import fs from 'node:fs/promises';
import path from 'node:path';
import {
    type AgentRuntimeAgent,
    type AgentRuntimeSkill,
    type AgentRuntimeSkillFile,
    type AgentRuntimeSkillSummary,
    agentRuntimeSkillListSchema,
    agentRuntimeSkillSchema,
    agentRuntimeSkillSummarySchema,
    isReservedAgentRuntimeSkillFilePath,
    normalizeAgentRuntimeSkillFiles,
} from '@tavern/api';
import { AGENT_HOME } from '../config.ts';
import {
    findPluginServiceForSkill,
    readPluginSkillBundlesForAgent,
} from '../plugins/agent-capabilities.ts';
import { resetPluginSkillToDefault } from '../plugins/materialize-skills.ts';
import { publishSkillUpdated } from '../skills/events.ts';
import { resolveSkillSource, sha256, tryRecordSkillSource } from '../skills/store.ts';

export const agentEngineSkillsDir = path.join(AGENT_HOME, 'skills');
export const tavernAgentSkillId = 'tavern-agent';

export const defaultTavernSkill = `# Tavern Agent

Use Tavern chat context, memory, files, and local tools. Keep replies direct and action-oriented.
`;

const emptyRequirements = {
    anyBins: [],
    bins: [],
    config: [],
    env: [],
    os: [],
};

export interface AssignedSkillBundle {
    content: string;
    description: string;
    files: AssignedSkillFile[];
    id: string;
    name: string;
    path: string | null;
}

export interface AssignedSkillFile {
    content: string;
    path: string;
}

interface RuntimeSkillOptions {
    agent?: AgentRuntimeAgent | null;
    includePluginSkills?: boolean;
    skillsDir?: string;
}

export async function seedTavernAgentSkill(options: { skillsDir?: string } = {}) {
    const skillPath = path.join(
        options.skillsDir ?? agentEngineSkillsDir,
        tavernAgentSkillId,
        'SKILL.md'
    );
    const existing = await fs.readFile(skillPath, 'utf8').catch(() => null);
    if (existing !== null) {
        tryRecordSkillSource({ skillId: tavernAgentSkillId, source: 'seeded' });
        return;
    }

    await fs.mkdir(path.dirname(skillPath), { recursive: true });
    await fs.writeFile(skillPath, defaultTavernSkill, { mode: 0o600 });
    tryRecordSkillSource({ skillId: tavernAgentSkillId, source: 'seeded' });
}

export async function resetTavernAgentSkill(options: { skillsDir?: string } = {}) {
    const skillPath = path.join(
        options.skillsDir ?? agentEngineSkillsDir,
        tavernAgentSkillId,
        'SKILL.md'
    );
    await fs.mkdir(path.dirname(skillPath), { recursive: true });
    await fs.writeFile(skillPath, defaultTavernSkill, { mode: 0o600 });
    tryRecordSkillSource({ skillId: tavernAgentSkillId, source: 'seeded' });
    publishSkillUpdated(tavernAgentSkillId);
    return {
        hash: sha256(defaultTavernSkill),
        skillId: tavernAgentSkillId,
    };
}

export async function resetRuntimeSkillToDefault(
    skillId: string,
    options: { skillsDir?: string } = {}
) {
    if (skillId === tavernAgentSkillId) {
        return await resetTavernAgentSkill(options);
    }
    const pluginReset = await resetPluginSkillToDefault(skillId, options);
    if (pluginReset) {
        return pluginReset;
    }
    throw new Error('Only seeded and Plugin skills have Tavern defaults.');
}

export async function listRuntimeSkills(options: RuntimeSkillOptions = {}) {
    const skillsDir = options.skillsDir ?? agentEngineSkillsDir;
    const scanned = await scanInstalledSkillSummaries(skillsDir);
    const hasTavernAgent = scanned.some((skill) => skill.id === tavernAgentSkillId);
    const installedSkills = hasTavernAgent ? scanned : [tavernAgentSummary(skillsDir), ...scanned];
    const agent = options.agent;
    const agentInstalledSkills = agent
        ? installedSkills.map((skill) => ({
              ...skill,
              eligible: agent.enabledSkillIds.includes(skill.id),
          }))
        : installedSkills;
    return agentRuntimeSkillListSchema.parse({
        skills: agentInstalledSkills.sort((left, right) => left.name.localeCompare(right.name)),
    }).skills;
}

export async function getRuntimeSkill(
    skillId: string,
    options: RuntimeSkillOptions = {}
): Promise<AgentRuntimeSkill | null> {
    const normalized = normalizeRuntimeSkillId(skillId);
    if (!normalized) {
        return null;
    }

    const summary = (await listRuntimeSkills(options)).find((skill) => skill.id === normalized);
    if (!summary) {
        return null;
    }

    const contentMarkdown =
        summary.id === tavernAgentSkillId
            ? await fs.readFile(summary.filePath ?? '', 'utf8').catch(() => defaultTavernSkill)
            : await readSkillMarkdown(summary);
    if (contentMarkdown === null) {
        return null;
    }

    return agentRuntimeSkillSchema.parse({
        ...summary,
        contentMarkdown,
        files: summary.baseDir ? await listSkillFiles(summary.baseDir) : [],
        installSource: null,
    });
}

export async function readAssignedSkillBundles(
    agent: Pick<AgentRuntimeAgent, 'enabledSkillIds'>,
    options: { skillsDir?: string } = {}
) {
    const bundles: AssignedSkillBundle[] = [];
    const seen = new Set<string>();

    for (const skillId of agent.enabledSkillIds) {
        if (seen.has(skillId)) {
            continue;
        }
        seen.add(skillId);
        if (tryResolveSkillSource(skillId) === 'plugin') {
            continue;
        }

        const skill = await getRuntimeSkill(skillId, {
            ...options,
            includePluginSkills: false,
        });
        if (!skill || skill.disabled === true) {
            continue;
        }

        bundles.push({
            content: skill.contentMarkdown,
            description: skill.description ?? skill.name,
            files: skill.baseDir ? await readSkillTextFiles(skill.baseDir) : [],
            id: skill.id,
            name: skill.name,
            path: skill.filePath ?? null,
        });
    }

    const pluginBundles =
        'enabledPluginIds' in agent
            ? await readPluginSkillBundlesForAgent(agent as AgentRuntimeAgent, options)
            : [];

    return [...bundles, ...pluginBundles];
}

async function scanInstalledSkillSummaries(skillsDir: string) {
    const entries = await fs.readdir(skillsDir, { withFileTypes: true }).catch(() => []);
    const summaries: AgentRuntimeSkillSummary[] = [];

    for (const entry of entries) {
        if (!entry.isDirectory()) {
            continue;
        }
        if (entry.name.startsWith('.')) {
            continue;
        }
        const skillId = normalizeRuntimeSkillId(entry.name);
        if (!skillId) {
            continue;
        }
        const baseDir = path.join(skillsDir, skillId);
        const filePath = path.join(baseDir, 'SKILL.md');
        const [content, stats] = await Promise.all([
            fs.readFile(filePath, 'utf8').catch(() => null),
            fs.stat(filePath).catch(() => null),
        ]);
        if (content === null) {
            continue;
        }
        summaries.push(
            skillSummaryFromMarkdown({
                baseDir,
                content,
                filePath,
                skillId,
                skillSource: tryResolveSkillSource(skillId),
                stats,
            })
        );
    }

    return summaries;
}

function skillSummaryFromMarkdown(input: {
    baseDir: string;
    content: string;
    filePath: string;
    skillId: string;
    skillSource: ReturnType<typeof tryResolveSkillSource>;
    stats: { mtime: Date } | null;
}) {
    const pluginMatch =
        input.skillSource === 'plugin' ? findPluginServiceForSkill(input.skillId) : null;
    return agentRuntimeSkillSummarySchema.parse({
        allowedTools: null,
        baseDir: input.baseDir,
        bundled: input.skillId === tavernAgentSkillId,
        commandVisible: true,
        configChecks: [],
        description: readSkillDescription(input.content),
        disabled: false,
        eligible: true,
        filePath: input.filePath,
        id: input.skillId,
        install: [],
        missing: emptyRequirements,
        modelVisible: true,
        name: input.skillId,
        primaryEnv: null,
        requirements: emptyRequirements,
        runtimeSource:
            input.skillId === tavernAgentSkillId
                ? 'Agent engine'
                : (pluginMatch?.service.skills.find((skill) => skill.name === input.skillId)
                      ?.runtimeSource ?? 'Installed skill'),
        skillKey: input.skillId,
        source: input.skillId === tavernAgentSkillId ? 'builtin' : 'installed',
        updatedAt: input.stats?.mtime.toISOString() ?? null,
        userInvocable: true,
    });
}

function tavernAgentSummary(skillsDir: string) {
    return skillSummaryFromMarkdown({
        baseDir: path.join(skillsDir, tavernAgentSkillId),
        content: defaultTavernSkill,
        filePath: path.join(skillsDir, tavernAgentSkillId, 'SKILL.md'),
        skillId: tavernAgentSkillId,
        skillSource: 'seeded',
        stats: null,
    });
}

function tryResolveSkillSource(skillId: string) {
    try {
        return resolveSkillSource(skillId);
    } catch (error) {
        if (error instanceof Error && error.message.includes('Database not initialized')) {
            return skillId === tavernAgentSkillId ? 'seeded' : 'external';
        }
        throw error;
    }
}

async function readSkillMarkdown(summary: AgentRuntimeSkillSummary) {
    if (!summary.filePath) {
        return null;
    }
    return await fs.readFile(summary.filePath, 'utf8').catch(() => null);
}

async function listSkillFiles(baseDir: string) {
    const files: AgentRuntimeSkillFile[] = [];
    await collectSkillFiles(baseDir, '', files);
    return normalizeAgentRuntimeSkillFiles(files);
}

async function readSkillTextFiles(baseDir: string) {
    const files = await listSkillFiles(baseDir);
    const textFiles: AssignedSkillFile[] = [];

    for (const file of files) {
        if (isReservedAgentRuntimeSkillFilePath(file.path)) {
            continue;
        }
        const content = await fs
            .readFile(path.join(baseDir, ...file.path.split('/')), 'utf8')
            .catch(() => null);
        if (content === null) {
            continue;
        }
        textFiles.push({
            content,
            path: file.path,
        });
    }

    return textFiles;
}

async function collectSkillFiles(
    baseDir: string,
    relativeDir: string,
    files: AgentRuntimeSkillFile[]
) {
    const dir = path.join(baseDir, relativeDir);
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);

    for (const entry of entries) {
        const relativePath = path.join(relativeDir, entry.name);
        if (entry.isDirectory()) {
            await collectSkillFiles(baseDir, relativePath, files);
            continue;
        }
        if (!entry.isFile()) {
            continue;
        }
        const stats = await fs.stat(path.join(baseDir, relativePath)).catch(() => null);
        if (stats) {
            files.push({
                path: relativePath.split(path.sep).join('/'),
                sizeBytes: stats.size,
            });
        }
    }
}

function readSkillDescription(content: string) {
    const metadata = readFrontmatter(content);
    const frontmatterDescription = metadata.description ?? metadata.summary;
    if (frontmatterDescription) {
        return frontmatterDescription;
    }

    const markdown = stripFrontmatter(content);
    const lines = markdown
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'));
    return lines[0] ?? null;
}

function readFrontmatter(content: string) {
    if (!content.startsWith('---')) {
        return {};
    }
    const end = content.indexOf('\n---', 3);
    if (end === -1) {
        return {};
    }

    const metadata: Record<string, string> = {};
    const block = content.slice(3, end).split(/\r?\n/u);
    for (const line of block) {
        const match = /^(?<key>[A-Za-z][A-Za-z0-9_-]*):\s*(?<value>.+)$/u.exec(line.trim());
        if (match?.groups) {
            metadata[match.groups.key] = match.groups.value.replace(/^["']|["']$/gu, '').trim();
        }
    }
    return metadata;
}

function stripFrontmatter(content: string) {
    if (!content.startsWith('---')) {
        return content;
    }
    const end = content.indexOf('\n---', 3);
    return end === -1 ? content : content.slice(end + 4).trimStart();
}

export function normalizeRuntimeSkillId(value: string) {
    const normalized = value.trim().toLowerCase();
    return /^[a-z0-9][a-z0-9._-]*$/u.test(normalized) && !normalized.startsWith('.')
        ? normalized
        : null;
}
