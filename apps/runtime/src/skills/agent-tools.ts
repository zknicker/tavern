import type { ToolSet } from '@ai-sdk/provider-utils';
import { tool } from 'ai';
import * as z from 'zod';
import {
    agentEngineSkillsDir,
    getRuntimeSkill,
    listRuntimeSkills,
    tavernAgentSkillId,
} from '../agent-engine/skill-library.ts';
import { getStoredAgent } from '../tavern/agents-store.ts';
import { archiveAgentSkill } from './lifecycle.ts';
import {
    createAgentSkill,
    listSkillSupportFileSnapshots,
    patchSkillMarkdown,
    readSkillMarkdownSnapshot,
    resolveSkillSource,
    sha256,
    skillIdFromName,
    writeSkillSupportFile,
} from './store.ts';
import { recordSkillUsage } from './telemetry.ts';

export function createTavernSkillTools(input: {
    agentId: string;
    createdByAgentId?: string | null;
    skillsDir?: string;
}): ToolSet {
    const skillsDir = input.skillsDir ?? agentEngineSkillsDir;
    return {
        skills_list: tool({
            description:
                'List all skills in the shared library, including whether each is enabled for you and whether you can edit it. Skill changes take effect next session.',
            inputSchema: listInputSchema,
            execute: async (rawInput) => {
                listInputSchema.parse(rawInput);
                const skills = await listRuntimeSkills({
                    includePluginSkills: false,
                    skillsDir,
                });
                return {
                    skills: skills.map((skill) =>
                        toToolSummary({
                            agentId: input.agentId,
                            description: skill.description ?? skill.name,
                            id: skill.id,
                            name: skill.name,
                        })
                    ),
                };
            },
        }),
        skill_view: tool({
            description:
                'Read one skill from the shared library, including SKILL.md content and hash for a later skill_patch. Skill changes take effect next session.',
            inputSchema: viewInputSchema,
            execute: async (rawInput) => {
                const parsed = viewInputSchema.parse(rawInput);
                const skill = await getRuntimeSkill(parsed.skillId, {
                    includePluginSkills: false,
                    skillsDir,
                });
                if (!skill) {
                    throw new Error(`Skill not found: ${parsed.skillId}`);
                }
                const snapshot = await readSkillMarkdownSnapshot({
                    skillId: skill.id,
                    skillsDir,
                });
                const content = snapshot?.content ?? skill.contentMarkdown;
                const supportFiles = await listSkillSupportFileSnapshots({
                    skillId: skill.id,
                    skillsDir,
                });
                recordSkillUsage({
                    agentId: input.agentId,
                    kind: 'viewed',
                    skillId: skill.id,
                });
                return {
                    ...toToolSummary({
                        agentId: input.agentId,
                        description: skill.description ?? skill.name,
                        id: skill.id,
                        name: skill.name,
                    }),
                    content,
                    hash: snapshot?.hash ?? sha256(content),
                    supportFilePaths: supportFiles.map((file) => file.path),
                    supportFiles,
                };
            },
        }),
        skill_create: tool({
            description:
                'Create a new class-level skill in the shared library. Prefer patching an existing skill. New skills are enabled for you automatically and take effect next session.',
            inputSchema: createInputSchema,
            execute: async (rawInput) => {
                const parsed = createInputSchema.parse(rawInput);
                const skillId = skillIdFromName(parsed.name);
                const existing = await listRuntimeSkills({
                    includePluginSkills: false,
                    skillsDir,
                });
                if (existing.some((skill) => skill.id === skillId)) {
                    throw new Error(`Skill already exists: ${skillId}`);
                }
                const created = await createAgentSkill({
                    agentId:
                        input.createdByAgentId === undefined
                            ? input.agentId
                            : input.createdByAgentId,
                    content: parsed.content,
                    description: parsed.description,
                    name: parsed.name,
                    skillsDir,
                });
                return {
                    skill: {
                        ...created,
                        enabledForYou: input.createdByAgentId !== null,
                    },
                };
            },
        }),
        skill_patch: tool({
            description:
                'Replace SKILL.md for an agent-authored skill using the hash from skill_view. Prefer this over creating a new skill. Changes take effect next session.',
            inputSchema: patchInputSchema,
            execute: async (rawInput) => {
                const parsed = patchInputSchema.parse(rawInput);
                const change = await patchSkillMarkdown({
                    content: parsed.content,
                    expectedHash: parsed.expectedHash,
                    skillId: parsed.skillId,
                    skillsDir,
                });
                return { change };
            },
        }),
        skill_write_file: tool({
            description:
                'Write a references/, templates/, scripts/, or assets/ file for an agent-authored skill using the current file hash, or null when creating it. Changes take effect next session.',
            inputSchema: writeFileInputSchema,
            execute: async (rawInput) => {
                const parsed = writeFileInputSchema.parse(rawInput);
                const change = await writeSkillSupportFile({
                    content: parsed.content,
                    expectedHash: parsed.expectedHash,
                    filePath: parsed.filePath,
                    skillId: parsed.skillId,
                    skillsDir,
                });
                return { change };
            },
        }),
    };
}

export function createCuratorSkillTools(input: { agentId: string; skillsDir?: string }): ToolSet {
    const skillsDir = input.skillsDir ?? agentEngineSkillsDir;
    return {
        ...createTavernSkillTools({
            agentId: input.agentId,
            createdByAgentId: null,
            skillsDir,
        }),
        skill_archive: tool({
            description:
                'Archive an agent-authored skill package after absorbing it into another skill, or prune it when it is stale and irrelevant. This moves the whole package to .archive and disables assignments.',
            inputSchema: archiveInputSchema,
            execute: async (rawInput) => {
                const parsed = archiveInputSchema.parse(rawInput);
                const archived = await archiveAgentSkill({
                    skillId: parsed.skillId,
                    skillsDir,
                });
                return {
                    archive: {
                        ...archived,
                        absorbedInto: parsed.absorbedInto,
                        reason: parsed.reason,
                    },
                };
            },
        }),
    };
}

const listInputSchema = z.object({}).strict();

const viewInputSchema = z
    .object({
        skillId: z.string().trim().min(1),
    })
    .strict();

const createInputSchema = z
    .object({
        content: z.string().min(1),
        description: z.string().trim().min(1),
        name: z.string().trim().min(1),
    })
    .strict();

const patchInputSchema = z
    .object({
        content: z.string().min(1),
        expectedHash: z.string().trim().min(1),
        skillId: z.string().trim().min(1),
    })
    .strict();

const writeFileInputSchema = z
    .object({
        content: z.string(),
        expectedHash: z.string().nullable(),
        filePath: z.string().trim().min(1),
        skillId: z.string().trim().min(1),
    })
    .strict();

const archiveInputSchema = z
    .object({
        absorbedInto: z.string().trim().min(1).nullable(),
        reason: z.string().trim().min(1),
        skillId: z.string().trim().min(1),
    })
    .strict();

function toToolSummary(input: { agentId: string; description: string; id: string; name: string }) {
    const source = input.id === tavernAgentSkillId ? 'seeded' : resolveSkillSource(input.id);
    const enabledForYou =
        getStoredAgent(input.agentId)?.enabledSkillIds.includes(input.id) ?? false;
    return {
        description: input.description,
        enabledForYou,
        id: input.id,
        name: input.name,
        source,
        writable: source === 'agent',
    };
}
