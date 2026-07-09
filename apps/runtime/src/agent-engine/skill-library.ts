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
import { readPluginSkillBundlesForAgent } from '../plugins/agent-capabilities.ts';
import { resetPluginSkillToDefault } from '../plugins/materialize-skills.ts';
import { publishSkillUpdated } from '../skills/events.ts';
import { sha256, tryRecordSkillSource } from '../skills/store.ts';
import {
    managedSkillSummaryState,
    type SkillSummarySource,
    tryReadSkillSummarySource,
    tryResolveSkillSource,
} from './managed-skill-summary.ts';

export const agentEngineSkillsDir = path.join(AGENT_HOME, 'skills');
export const tavernAgentSkillId = 'tavern-agent';
export const tasksSkillId = 'tasks';

export const defaultTavernSkill = `# Tavern Agent

Use Tavern chat context, memory, files, and local tools. Keep replies direct and action-oriented.
`;

export const defaultTasksSkill = `---
name: tasks
description: >
  Use for the shared Tasks board: filing tracked work, updating task status,
  working dispatched tasks, epics, and T-number references.
---

# Tasks

Managed by Tavern. Do not edit this skill directory; Tavern refreshes it on
startup. For durable agent-managed skill changes, create or update a separate
skill in your normal skills directory.

The Tasks board is the durable work tracker you share with the user. Every
item has a short T-number (T-1, T-2, ...) either of you can drop into a chat
message. The user sees the board on the Tasks page; keep it accurate enough
to trust.

## Tools

Use \`tasks_list\`, \`tasks_get\`, \`tasks_create\`, and \`tasks_update\`.
Reference tasks as T-<number> in replies so the user can find them on the
board.

## When to file a task

File a task when the user asks to track work, or when real follow-up work
surfaces that should outlive this conversation. Would the user expect to see
it on the board? Then file it: short imperative title, description with
enough context to act on later without this chat.

Do not mirror your in-conversation working steps onto the board. The board
tracks outcomes the user cares about, not your scratch plan for the current
turn.

## Working a task

Statuses:
- backlog: filed for user triage.
- todo: ready queue; only the user promotes work here.
- in_progress: actively being worked.
- blocked: cannot continue until input arrives or an error is resolved.
- review: ready for the user to check.
- done: finished.
- canceled: intentionally closed without doing it.

Agent-created tasks always land in backlog. Never set a task to todo; the user
promotes work into the queue.

For ordered batches, file the chain with blockedBy T-numbers so work runs in
order once the user promotes it. For dated one-shot follow-ups, set
scheduledFor, like "check ad performance next week". Both still start in
backlog for user triage.

Labels are shared records. Reuse existing label names from \`tasks_list\` when
they fit; new label names are created automatically.

Mark a task in_progress before you start it. When closing as done, review, or
canceled, include a short summary: what changed, how you verified it, and what
remains. The description is the brief; never overwrite it for close-out.

If you cannot finish, set the task blocked with a reason kind:
- needs_input: the user must answer or provide something.
- error: the work failed; include the failure detail.

Keep one task in_progress per stream of work.

## Dispatched tasks

A dispatch message arrives in the task's own work chat and names a task (like
T-12). Treat it as your work order: read it first with \`tasks_get\`, mark it
in_progress, do the work in that work chat, keep the task updated as scope
changes, and close it: done when you deliver, blocked when you cannot continue,
canceled when the work should not happen. The work chat archives when the task
closes and remains reachable from the task page. Close the task before ending
your reply; a finished turn left in_progress is a failed attempt.

## Epics and hygiene

Group related tasks under an epic when a push spans several tasks; check for
an existing epic with \`tasks_list\` before creating one. Search the board
before filing to avoid duplicates. Update stale tasks instead of abandoning
them.
`;

const seededSkillDefaults: Record<string, string> = {
    [tasksSkillId]: defaultTasksSkill,
    [tavernAgentSkillId]: defaultTavernSkill,
};

export function isSeededSkillId(skillId: string): boolean {
    return skillId in seededSkillDefaults;
}

export function seededSkillDefaultEntries(): [skillId: string, content: string][] {
    return Object.entries(seededSkillDefaults);
}

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

export async function seedManagedSkills(options: { skillsDir?: string } = {}) {
    for (const skillId of Object.keys(seededSkillDefaults)) {
        await seedSeededSkill(skillId, options);
    }
}

async function seedSeededSkill(skillId: string, options: { skillsDir?: string } = {}) {
    const skillPath = path.join(options.skillsDir ?? agentEngineSkillsDir, skillId, 'SKILL.md');
    const existing = await fs.readFile(skillPath, 'utf8').catch(() => null);
    if (existing !== null) {
        recordSeededSkillSource(skillId);
        return;
    }

    await fs.mkdir(path.dirname(skillPath), { recursive: true });
    await fs.writeFile(skillPath, seededSkillDefaults[skillId], { mode: 0o600 });
    recordSeededSkillSource(skillId);
}

export async function resetSeededSkill(skillId: string, options: { skillsDir?: string } = {}) {
    const defaultContent = seededSkillDefaults[skillId];
    if (defaultContent === undefined) {
        throw new Error(`Skill ${skillId} is not a seeded Tavern skill.`);
    }
    const skillPath = path.join(options.skillsDir ?? agentEngineSkillsDir, skillId, 'SKILL.md');
    await fs.mkdir(path.dirname(skillPath), { recursive: true });
    await fs.writeFile(skillPath, defaultContent, { mode: 0o600 });
    recordSeededSkillSource(skillId);
    publishSkillUpdated(skillId);
    return {
        hash: sha256(defaultContent),
        skillId,
    };
}

export async function resetRuntimeSkillToDefault(
    skillId: string,
    options: { skillsDir?: string } = {}
) {
    if (isSeededSkillId(skillId)) {
        return await resetSeededSkill(skillId, options);
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
    const missingSeeded = Object.keys(seededSkillDefaults)
        .filter((skillId) => !scanned.some((skill) => skill.id === skillId))
        .map((skillId) => seededSkillSummary(skillsDir, skillId));
    const installedSkills = [...missingSeeded, ...scanned];
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

    const seededDefault = seededSkillDefaults[summary.id];
    const contentMarkdown =
        seededDefault === undefined
            ? await readSkillMarkdown(summary)
            : await fs.readFile(summary.filePath ?? '', 'utf8').catch(() => seededDefault);
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
        if (tryResolveSkillSource({ seededSkillId: tavernAgentSkillId, skillId }) === 'plugin') {
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
                skillSource: tryReadSkillSummarySource(skillId),
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
    skillSource: SkillSummarySource | null;
    stats: { mtime: Date } | null;
}) {
    const seeded = isSeededSkillId(input.skillId);
    const managedState = managedSkillSummaryState({
        content: input.content,
        defaultSeededContent: seededSkillDefaults[input.skillId] ?? defaultTavernSkill,
        seededSkillId: seeded ? input.skillId : tavernAgentSkillId,
        skillId: input.skillId,
        skillSource: input.skillSource,
    });
    return agentRuntimeSkillSummarySchema.parse({
        allowedTools: null,
        baseDir: input.baseDir,
        bundled: seeded,
        commandVisible: true,
        configChecks: [],
        description: readSkillDescription(input.content),
        disabled: false,
        edited: managedState.edited,
        eligible: true,
        filePath: input.filePath,
        id: input.skillId,
        install: [],
        managedSource: managedState.managedSource,
        missing: emptyRequirements,
        modelVisible: true,
        name: input.skillId,
        primaryEnv: null,
        requirements: emptyRequirements,
        runtimeSource: seeded
            ? 'Agent engine'
            : (managedState.pluginRuntimeSource ?? 'Installed skill'),
        skillKey: input.skillId,
        source: seeded ? 'builtin' : 'installed',
        updateAvailable: managedState.updateAvailable,
        updatedAt: input.stats?.mtime.toISOString() ?? null,
        userInvocable: true,
    });
}

function seededSkillSummary(skillsDir: string, skillId: string) {
    return skillSummaryFromMarkdown({
        baseDir: path.join(skillsDir, skillId),
        content: seededSkillDefaults[skillId],
        filePath: path.join(skillsDir, skillId, 'SKILL.md'),
        skillId,
        skillSource: {
            installedHash: sha256(seededSkillDefaults[skillId]),
            source: 'seeded',
        },
        stats: null,
    });
}

function recordSeededSkillSource(skillId: string) {
    tryRecordSkillSource({
        installedHash: sha256(seededSkillDefaults[skillId]),
        skillId,
        source: 'seeded',
    });
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
