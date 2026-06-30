import fs from 'node:fs/promises';
import path from 'node:path';
import {
    type AgentRuntimeSkillHubActionResult,
    type AgentRuntimeSkillHubAvailable,
    type AgentRuntimeSkillHubItem,
    type AgentRuntimeSkillHubPreview,
    type AgentRuntimeSkillHubScan,
    agentRuntimeSkillHubActionResultSchema,
    agentRuntimeSkillHubAvailableSchema,
    agentRuntimeSkillHubPreviewSchema,
    agentRuntimeSkillHubScanSchema,
} from '@tavern/api';
import {
    agentEngineSkillsDir,
    listRuntimeSkills,
    normalizeRuntimeSkillId,
    tavernAgentSkillId,
} from './skill-library.ts';

const tavernWorkflowSkillId = 'tavern-workflow';
const tavernWorkflowIdentifier = `builtin:${tavernWorkflowSkillId}`;
const tavernWorkflowSkillMd = `---
summary: Tavern workflow
---

# Tavern Workflow

Use Tavern workspace context, keep durable knowledge in Vault, and keep execution focused on the active chat goal.
`;

const builtInHubSkills = [
    {
        description: 'Tavern workspace habits, durable notes, and focused execution guidance.',
        identifier: tavernWorkflowIdentifier,
        name: tavernWorkflowSkillId,
        repo: null,
        skillMd: tavernWorkflowSkillMd,
        source: 'builtin',
        tags: ['tavern', 'workflow'],
        trustLevel: 'builtin',
    },
] satisfies Array<AgentRuntimeSkillHubItem & { skillMd: string }>;

export async function getSkillHubAvailable(
    options: { skillsDir?: string } = {}
): Promise<AgentRuntimeSkillHubAvailable> {
    const installedSkills = await listRuntimeSkills(options);
    const installedNames = new Set(installedSkills.map((skill) => skill.name));

    return agentRuntimeSkillHubAvailableSchema.parse({
        builtin: builtInHubSkills.map(({ skillMd: _skillMd, ...skill }) => skill),
        installed: Object.fromEntries(
            builtInHubSkills
                .filter((skill) => installedNames.has(skill.name))
                .map((skill) => [
                    skill.identifier,
                    {
                        name: skill.name,
                        scanVerdict: 'allow',
                        trustLevel: skill.trustLevel,
                    },
                ])
        ),
        taps: [],
    });
}

export function previewSkillHubSkill(identifier: string): AgentRuntimeSkillHubPreview | null {
    const skill = builtInHubSkills.find((candidate) => candidate.identifier === identifier);
    if (!skill) {
        return null;
    }

    const { skillMd, ...item } = skill;
    return agentRuntimeSkillHubPreviewSchema.parse({
        ...item,
        files: ['SKILL.md'],
        skillMd,
    });
}

export function scanSkillHubSkill(identifier: string): AgentRuntimeSkillHubScan | null {
    const skill = builtInHubSkills.find((candidate) => candidate.identifier === identifier);
    if (!skill) {
        return null;
    }

    return agentRuntimeSkillHubScanSchema.parse({
        findings: [],
        identifier: skill.identifier,
        name: skill.name,
        policy: 'allow',
        policyReason: 'Built-in Tavern skill.',
        severityCounts: {},
        source: skill.source,
        summary: 'No findings.',
        trustLevel: skill.trustLevel,
        verdict: 'allow',
    });
}

export async function installSkillHubSkill(
    identifier: string,
    options: { skillsDir?: string } = {}
): Promise<AgentRuntimeSkillHubActionResult> {
    const skill = builtInHubSkills.find((candidate) => candidate.identifier === identifier);
    if (!skill) {
        return actionResult(false, [`Unknown skill: ${identifier}`], null);
    }

    const skillPath = path.join(options.skillsDir ?? agentEngineSkillsDir, skill.name, 'SKILL.md');
    await fs.mkdir(path.dirname(skillPath), { recursive: true });
    await fs.writeFile(skillPath, skill.skillMd, { mode: 0o600 });

    return actionResult(true, [`Installed ${skill.name}.`], 0);
}

export async function uninstallSkillHubSkill(
    name: string,
    options: { skillsDir?: string } = {}
): Promise<AgentRuntimeSkillHubActionResult> {
    const normalized = normalizeRuntimeSkillId(name);
    if (!normalized) {
        return actionResult(false, [`Invalid skill name: ${name}`], null);
    }
    if (normalized === tavernAgentSkillId) {
        return actionResult(false, ['tavern-agent is a bundled Runtime skill.'], null);
    }

    const skillDir = path.join(options.skillsDir ?? agentEngineSkillsDir, normalized);
    const exists = await fs.stat(path.join(skillDir, 'SKILL.md')).catch(() => null);
    if (!exists) {
        return actionResult(false, [`Skill is not installed: ${normalized}`], null);
    }

    await fs.rm(skillDir, { force: true, recursive: true });
    return actionResult(true, [`Uninstalled ${normalized}.`], 0);
}

function actionResult(
    ok: boolean,
    log: string[],
    exitCode: number | null
): AgentRuntimeSkillHubActionResult {
    return agentRuntimeSkillHubActionResultSchema.parse({ exitCode, log, ok });
}
