import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { installSkillHubSkill } from '../agent-engine/skill-hub-library.ts';
import { seedManagedSkills, tavernAgentSkillId } from '../agent-engine/skill-library.ts';
import { closeDb, getDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import { getStoredAgent, upsertStoredAgent } from '../tavern/agents-store.ts';
import { readHarnessAgentSkills } from '../tavern/harness-agent-executor.ts';
import { createTavernSkillTools } from './agent-tools.ts';
import { recordSkillSource, sha256 } from './store.ts';
import { readSkillUsageSummary } from './telemetry.ts';

describe('skill agent tools', () => {
    let skillsDir: string;

    beforeEach(async () => {
        skillsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-skill-tools-'));
        ensureRuntimeSchema(initTestDb());
        upsertAgent('agt_author', []);
        upsertAgent('agt_other', []);
    });

    afterEach(async () => {
        closeDb();
        await fs.rm(skillsDir, { force: true, recursive: true });
    });

    test('creates a skill on disk, records agent source, and enables only the author', async () => {
        const tools = createTavernSkillTools({ agentId: 'agt_author', skillsDir });

        const created = await runTool<Record<string, unknown>, { skill: Record<string, unknown> }>(
            tools,
            'skill_create',
            {
                content: '---\nsummary: Debug flows\n---\n\n# Debug Flow\n\nInspect evidence.',
                description: 'Debug flows',
                name: 'Debug Flow',
            }
        );

        await expect(
            fs.readFile(path.join(skillsDir, 'debug-flow', 'SKILL.md'), 'utf8')
        ).resolves.toContain('# Debug Flow');
        expect(skillSource('debug-flow')).toEqual({
            created_by_agent_id: 'agt_author',
            source: 'agent',
        });
        expect(getStoredAgent('agt_author')?.enabledSkillIds).toEqual(['debug-flow']);
        expect(getStoredAgent('agt_other')?.enabledSkillIds).toEqual([]);
        expect(created.skill).toMatchObject({
            enabledForYou: true,
            id: 'debug-flow',
            source: 'agent',
            writable: true,
        });
    });

    test('rejects stale skill patches and accepts the current hash', async () => {
        const tools = createTavernSkillTools({ agentId: 'agt_author', skillsDir });
        await runTool(tools, 'skill_create', {
            content: '# Release Notes\n\nInitial.',
            description: 'Release notes',
            name: 'Release Notes',
        });
        const viewed = await runTool<Record<string, unknown>, { hash: string }>(
            tools,
            'skill_view',
            { skillId: 'release-notes' }
        );

        await expect(
            runTool(tools, 'skill_patch', {
                content: '# Release Notes\n\nStale.',
                expectedHash: 'stale',
                skillId: 'release-notes',
            })
        ).rejects.toThrow('Skill changed since it was read.');

        await expect(
            runTool(tools, 'skill_patch', {
                content: '# Release Notes\n\nUpdated.',
                expectedHash: viewed.hash,
                skillId: 'release-notes',
            })
        ).resolves.toMatchObject({
            change: {
                beforeHash: viewed.hash,
                path: 'SKILL.md',
                skillId: 'release-notes',
            },
        });
        await expect(
            fs.readFile(path.join(skillsDir, 'release-notes', 'SKILL.md'), 'utf8')
        ).resolves.toBe('# Release Notes\n\nUpdated.');
    });

    test('validates support file paths and accepts supported directories', async () => {
        const tools = createTavernSkillTools({ agentId: 'agt_author', skillsDir });
        await runTool(tools, 'skill_create', {
            content: '# Support Files\n',
            description: 'Support files',
            name: 'Support Files',
        });

        for (const filePath of ['../x', '/tmp/x', 'refs/../../x', 'README.md']) {
            await expect(
                runTool(tools, 'skill_write_file', {
                    content: 'bad',
                    expectedHash: null,
                    filePath,
                    skillId: 'support-files',
                })
            ).rejects.toThrow();
        }

        for (const filePath of [
            'references/checklist.md',
            'templates/brief.md',
            'scripts/run.sh',
            'assets/prompt.txt',
        ]) {
            await expect(
                runTool(tools, 'skill_write_file', {
                    content: filePath,
                    expectedHash: null,
                    filePath,
                    skillId: 'support-files',
                })
            ).resolves.toMatchObject({
                change: { beforeHash: null, path: filePath, skillId: 'support-files' },
            });
        }
    });

    test('accepts writes to seeded, hub, and external disk skills', async () => {
        const tools = createTavernSkillTools({ agentId: 'agt_author', skillsDir });
        await seedManagedSkills({ skillsDir });
        await installSkillHubSkill('builtin:tavern-workflow', { skillsDir });
        await writeSkill('operator-skill', '# Operator Skill\n');

        for (const skillId of [tavernAgentSkillId, 'tavern-workflow', 'operator-skill']) {
            const viewed = await runTool<Record<string, unknown>, { hash: string }>(
                tools,
                'skill_view',
                { skillId }
            );
            await expect(
                runTool(tools, 'skill_patch', {
                    content: `# ${skillId}\n\nUpdated.`,
                    expectedHash: viewed.hash,
                    skillId,
                })
            ).resolves.toMatchObject({
                change: { path: 'SKILL.md', skillId },
            });
            await expect(
                runTool(tools, 'skill_write_file', {
                    content: 'notes',
                    expectedHash: null,
                    filePath: 'references/notes.md',
                    skillId,
                })
            ).resolves.toMatchObject({
                change: { path: 'references/notes.md', skillId },
            });
        }
    });

    test('edits materialized Plugin skills like other disk skills', async () => {
        const original = '# MerchBase\n\nOriginal guidance.';
        await writeSkill('merchbase', original);
        recordSkillSource({
            installedHash: sha256(original),
            skillId: 'merchbase',
            source: 'plugin',
        });
        const tools = createTavernSkillTools({ agentId: 'agt_author', skillsDir });
        const viewed = await runTool<Record<string, unknown>, { hash: string }>(
            tools,
            'skill_view',
            { skillId: 'merchbase' }
        );

        await expect(
            runTool(tools, 'skill_patch', {
                content: '# MerchBase\n\nUpdated.',
                expectedHash: viewed.hash,
                skillId: 'merchbase',
            })
        ).resolves.toMatchObject({
            change: { path: 'SKILL.md', skillId: 'merchbase' },
        });
        await expect(
            runTool(tools, 'skill_write_file', {
                content: 'notes',
                expectedHash: null,
                filePath: 'references/notes.md',
                skillId: 'merchbase',
            })
        ).resolves.toMatchObject({
            change: { path: 'references/notes.md', skillId: 'merchbase' },
        });
    });

    test('derives ids from names and rejects collisions', async () => {
        const tools = createTavernSkillTools({ agentId: 'agt_author', skillsDir });

        await expect(
            runTool(tools, 'skill_create', {
                content: '# PR Review\n',
                description: 'PR review',
                name: 'PR Review!',
            })
        ).resolves.toMatchObject({ skill: { id: 'pr-review' } });
        await expect(
            runTool(tools, 'skill_create', {
                content: '# Duplicate\n',
                description: 'Duplicate',
                name: 'pr review',
            })
        ).rejects.toThrow('Skill already exists: pr-review');
    });

    test('records viewed and injected usage and summarizes it', async () => {
        const tools = createTavernSkillTools({ agentId: 'agt_author', skillsDir });
        await runTool(tools, 'skill_create', {
            content: '# Usage Skill\n',
            description: 'Usage skill',
            name: 'Usage Skill',
        });
        const agent = getStoredAgent('agt_author');
        if (!agent) {
            throw new Error('missing test agent');
        }

        await runTool(tools, 'skill_view', { skillId: 'usage-skill' });
        await readHarnessAgentSkills(
            {
                agent: { ...agent, enabledSkillIds: ['usage-skill', 'usage-skill'] },
            } as Parameters<typeof readHarnessAgentSkills>[0],
            { skillsDir }
        );

        expect(readSkillUsageSummary('usage-skill')).toMatchObject({
            lastUsedAt: expect.any(String),
            useCount: 2,
        });
    });

    test('lists writable and enabledForYou for different agents', async () => {
        await writeSkill('operator-skill', '# Operator Skill\n');
        await runTool(
            createTavernSkillTools({ agentId: 'agt_author', skillsDir }),
            'skill_create',
            {
                content: '# Shared Habit\n',
                description: 'Shared habit',
                name: 'Shared Habit',
            }
        );
        upsertAgent('agt_other', ['operator-skill', 'shared-habit']);

        await expect(
            runTool(createTavernSkillTools({ agentId: 'agt_author', skillsDir }), 'skills_list', {})
        ).resolves.toMatchObject({
            skills: expect.arrayContaining([
                expect.objectContaining({
                    enabledForYou: true,
                    id: 'shared-habit',
                    source: 'agent',
                    writable: true,
                }),
                expect.objectContaining({
                    enabledForYou: false,
                    id: 'operator-skill',
                    source: 'external',
                    writable: true,
                }),
            ]),
        });
        await expect(
            runTool(createTavernSkillTools({ agentId: 'agt_other', skillsDir }), 'skills_list', {})
        ).resolves.toMatchObject({
            skills: expect.arrayContaining([
                expect.objectContaining({
                    enabledForYou: true,
                    id: 'operator-skill',
                    writable: true,
                }),
                expect.objectContaining({
                    enabledForYou: true,
                    id: 'shared-habit',
                    writable: true,
                }),
            ]),
        });
    });

    async function writeSkill(skillId: string, content: string) {
        await fs.mkdir(path.join(skillsDir, skillId), { recursive: true });
        await fs.writeFile(path.join(skillsDir, skillId, 'SKILL.md'), content);
    }
});

type SkillTools = ReturnType<typeof createTavernSkillTools>;
type SkillToolName = keyof SkillTools;

async function runTool<Input, Output>(
    tools: SkillTools,
    name: SkillToolName,
    input: Input
): Promise<Output> {
    const selected = tools[name] as unknown as {
        execute: (
            input: Input,
            options: { context: unknown; messages: []; toolCallId: string }
        ) => Output | PromiseLike<Output>;
    };
    return await selected.execute(input, {
        context: undefined,
        messages: [],
        toolCallId: `call_${String(name)}`,
    });
}

function upsertAgent(agentId: string, enabledSkillIds: string[]) {
    upsertStoredAgent({
        agent: {
            enabledSkillIds,
            id: agentId,
            isAdmin: false,
            name: agentId,
            primaryColor: null,
            workspaceFolder: path.join(os.tmpdir(), agentId),
        },
    });
}

function skillSource(skillId: string) {
    return getDb()
        .prepare(
            `SELECT source, created_by_agent_id
             FROM skill_sources
             WHERE skill_id = $skillId`
        )
        .get({ $skillId: skillId });
}
