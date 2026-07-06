import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, getDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import { readSkillSource, sha256 } from '../skills/store.ts';
import { getSkillHubAvailable, installSkillHubSkill } from './skill-hub-library.ts';
import {
    defaultTavernSkill,
    getRuntimeSkill,
    listRuntimeSkills,
    readAssignedSkillBundles,
    resetRuntimeSkillToDefault,
    resetTavernAgentSkill,
    tavernAgentSkillId,
} from './skill-library.ts';

describe('Runtime skill library', () => {
    let skillsDir: string;

    beforeEach(async () => {
        skillsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-skills-'));
        ensureRuntimeSchema(initTestDb());
    });

    afterEach(async () => {
        closeDb();
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
        expect(readSkillSource('tavern-workflow')?.installedHash).toBe(
            sha256(await fs.readFile(path.join(skillsDir, 'tavern-workflow', 'SKILL.md'), 'utf8'))
        );

        await expect(getSkillHubAvailable({ skillsDir })).resolves.toMatchObject({
            installed: {
                'builtin:tavern-workflow': {
                    edited: false,
                    name: 'tavern-workflow',
                    scanVerdict: 'allow',
                    trustLevel: 'builtin',
                    updateAvailable: false,
                },
            },
        });
        await expect(listRuntimeSkills({ includePluginSkills: false, skillsDir })).resolves.toEqual(
            expect.arrayContaining([expect.objectContaining({ id: 'tavern-workflow' })])
        );
    });

    it('reports hub edited and update flags from installed hashes', async () => {
        await installSkillHubSkill('builtin:tavern-workflow', { skillsDir });

        await expect(getSkillHubAvailable({ skillsDir })).resolves.toMatchObject({
            installed: {
                'builtin:tavern-workflow': { edited: false, updateAvailable: false },
            },
        });

        await fs.appendFile(path.join(skillsDir, 'tavern-workflow', 'SKILL.md'), '\nLocal note.');
        await expect(getSkillHubAvailable({ skillsDir })).resolves.toMatchObject({
            installed: {
                'builtin:tavern-workflow': { edited: true, updateAvailable: false },
            },
        });

        const oldBundle = '# Old Tavern Workflow\n';
        const oldBundleHash = sha256(oldBundle);
        getDb()
            .prepare(
                `UPDATE skill_sources
                 SET installed_hash = $hash
                 WHERE skill_id = 'tavern-workflow'`
            )
            .run({ $hash: oldBundleHash });
        await fs.writeFile(path.join(skillsDir, 'tavern-workflow', 'SKILL.md'), oldBundle, 'utf8');
        await expect(getSkillHubAvailable({ skillsDir })).resolves.toMatchObject({
            installed: {
                'builtin:tavern-workflow': { edited: false, updateAvailable: true },
            },
        });

        getDb()
            .prepare(
                `UPDATE skill_sources
                 SET installed_hash = NULL
                 WHERE skill_id = 'tavern-workflow'`
            )
            .run();
        await expect(getSkillHubAvailable({ skillsDir })).resolves.toMatchObject({
            installed: {
                'builtin:tavern-workflow': { edited: false, updateAvailable: false },
            },
        });
    });

    it('returns install conflicts for edited hub skills unless force is set', async () => {
        await installSkillHubSkill('builtin:tavern-workflow', { skillsDir });
        await fs.appendFile(path.join(skillsDir, 'tavern-workflow', 'SKILL.md'), '\nLocal note.');

        await expect(
            installSkillHubSkill('builtin:tavern-workflow', { skillsDir })
        ).resolves.toMatchObject({
            conflict: true,
            exitCode: null,
            ok: false,
        });
        await expect(
            fs.readFile(path.join(skillsDir, 'tavern-workflow', 'SKILL.md'), 'utf8')
        ).resolves.toContain('Local note.');

        await expect(
            installSkillHubSkill('builtin:tavern-workflow', { force: true, skillsDir })
        ).resolves.toMatchObject({ ok: true });
        await expect(
            fs.readFile(path.join(skillsDir, 'tavern-workflow', 'SKILL.md'), 'utf8')
        ).resolves.not.toContain('Local note.');
    });

    it('resets the seeded Tavern skill to the release default', async () => {
        await writeSkill(tavernAgentSkillId, '# Tavern Agent\n\nLocal edit.');

        await expect(resetTavernAgentSkill({ skillsDir })).resolves.toEqual({
            hash: sha256(defaultTavernSkill),
            skillId: tavernAgentSkillId,
        });
        await expect(
            fs.readFile(path.join(skillsDir, tavernAgentSkillId, 'SKILL.md'), 'utf8')
        ).resolves.toBe(defaultTavernSkill);
        expect(readSkillSource(tavernAgentSkillId)?.source).toBe('seeded');
    });

    it('rejects reset for non-seeded skills', async () => {
        await expect(resetRuntimeSkillToDefault('tavern-workflow', { skillsDir })).rejects.toThrow(
            'Only the seeded skill has a Tavern default.'
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

    it('ignores dot directories such as the skill archive', async () => {
        await writeSkill('active-skill', '# Active Skill\n\nUse this.');
        await fs.mkdir(path.join(skillsDir, '.archive', 'old-skill'), { recursive: true });
        await fs.writeFile(
            path.join(skillsDir, '.archive', 'old-skill', 'SKILL.md'),
            '# Old Skill\n\nArchived.',
            'utf8'
        );

        await expect(listRuntimeSkills({ includePluginSkills: false, skillsDir })).resolves.toEqual(
            expect.arrayContaining([expect.objectContaining({ id: 'active-skill' })])
        );
        await expect(
            listRuntimeSkills({ includePluginSkills: false, skillsDir })
        ).resolves.not.toEqual(
            expect.arrayContaining([expect.objectContaining({ id: 'old-skill' })])
        );
    });

    async function writeSkill(name: string, content: string) {
        const skillDir = path.join(skillsDir, name);
        await fs.mkdir(skillDir, { recursive: true });
        await fs.writeFile(path.join(skillDir, 'SKILL.md'), content, 'utf8');
    }
});
