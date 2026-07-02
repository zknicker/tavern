import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getSkillHubAvailable, installSkillHubSkill } from './skill-hub-library.ts';
import {
    getRuntimeSkill,
    listRuntimeSkills,
    readAssignedSkillBundles,
    tavernAgentSkillId,
} from './skill-library.ts';

describe('Runtime skill library', () => {
    let skillsDir: string;

    beforeEach(async () => {
        skillsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-skills-'));
    });

    afterEach(async () => {
        await fs.rm(skillsDir, { force: true, recursive: true });
    });

    it('lists installed skill packages and exposes detail content', async () => {
        await writeSkill(
            'research',
            '---\nsummary: Research well\n---\n\n# Research\n\nUse sources.'
        );
        await fs.writeFile(path.join(skillsDir, 'research', 'README.md'), 'extra', 'utf8');

        const skills = await listRuntimeSkills({ includePluginSkills: false, skillsDir });
        const skill = await getRuntimeSkill('research', { includePluginSkills: false, skillsDir });
        const coreSkill = await getRuntimeSkill(tavernAgentSkillId, {
            includePluginSkills: false,
            skillsDir,
        });

        expect(skills).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ id: tavernAgentSkillId, source: 'builtin' }),
                expect.objectContaining({
                    description: 'Research well',
                    id: 'research',
                    source: 'installed',
                }),
            ])
        );
        expect(skill).toMatchObject({
            contentMarkdown: expect.stringContaining('Use sources.'),
            files: expect.arrayContaining([
                { path: 'README.md', sizeBytes: 5 },
                expect.objectContaining({ path: 'SKILL.md' }),
            ]),
            id: 'research',
        });
        expect(coreSkill).toMatchObject({
            contentMarkdown: expect.stringContaining('# Tavern Agent'),
            id: tavernAgentSkillId,
        });
    });

    it('installs built-in hub skills into the inventory', async () => {
        await expect(getSkillHubAvailable({ skillsDir })).resolves.toMatchObject({
            installed: {},
        });

        await expect(
            installSkillHubSkill('builtin:tavern-workflow', { skillsDir })
        ).resolves.toMatchObject({
            ok: true,
        });

        await expect(getSkillHubAvailable({ skillsDir })).resolves.toMatchObject({
            installed: {
                'builtin:tavern-workflow': {
                    name: 'tavern-workflow',
                    scanVerdict: 'allow',
                    trustLevel: 'builtin',
                },
            },
        });
        await expect(listRuntimeSkills({ includePluginSkills: false, skillsDir })).resolves.toEqual(
            expect.arrayContaining([expect.objectContaining({ id: 'tavern-workflow' })])
        );
    });

    it('loads assigned skill content for agent execution', async () => {
        await writeSkill('research', '# Research\n\nCheck primary sources.');
        await fs.mkdir(path.join(skillsDir, 'research', 'references'), { recursive: true });
        await fs.writeFile(
            path.join(skillsDir, 'research', 'references', 'checklist.md'),
            'Use primary sources.',
            'utf8'
        );

        await expect(
            readAssignedSkillBundles(
                {
                    enabledSkillIds: ['missing', 'research', 'research'],
                },
                { skillsDir }
            )
        ).resolves.toEqual([
            {
                content: '# Research\n\nCheck primary sources.',
                description: 'Check primary sources.',
                files: [
                    {
                        content: 'Use primary sources.',
                        path: 'references/checklist.md',
                    },
                ],
                id: 'research',
                name: 'research',
                path: path.join(skillsDir, 'research', 'SKILL.md'),
            },
        ]);
    });

    async function writeSkill(name: string, content: string) {
        const skillDir = path.join(skillsDir, name);
        await fs.mkdir(skillDir, { recursive: true });
        await fs.writeFile(path.join(skillDir, 'SKILL.md'), content, 'utf8');
    }
});
