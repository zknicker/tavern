import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { AgentRuntimeAgent } from '@tavern/api';
import { merchbasePluginId } from '@tavern/api/plugins/merchbase';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, getDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import { findPluginServiceForSkill, pluginSkillContent } from '../plugins/agent-capabilities.ts';
import { materializePluginSkills } from '../plugins/materialize-skills.ts';
import { writePluginConfig } from '../plugins/store.ts';
import { readSkillSource, sha256 } from '../skills/store.ts';
import { upsertStoredAgent } from '../tavern/agents-store.ts';
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

        const skills = await listRuntimeSkills({
            includePluginSkills: false,
            skillsDir,
        });
        const skill = await getRuntimeSkill('research', {
            includePluginSkills: false,
            skillsDir,
        });
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
            installSkillHubSkill('builtin:tavern-workflow', {
                force: true,
                skillsDir,
            })
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
            'Only seeded and Plugin skills have Tavern defaults.'
        );
    });

    it('materializes enabled Plugin service skills with source and installed hash', async () => {
        enableMerchbasePlugin();

        await expect(materializePluginSkills({ skillsDir })).resolves.toMatchObject({
            created: ['merchbase'],
            refreshed: [],
        });
        await expect(materializePluginSkills({ skillsDir })).resolves.toMatchObject({
            created: [],
            refreshed: [],
        });

        const content = await fs.readFile(path.join(skillsDir, 'merchbase', 'SKILL.md'), 'utf8');
        expect(content).toBe(merchbaseSkillContent());
        expect(readSkillSource('merchbase')).toMatchObject({
            installedHash: sha256(content),
            source: 'plugin',
        });
    });

    it('refreshes unedited Plugin skills and preserves edited Plugin skills', async () => {
        enableMerchbasePlugin();
        const oldContent = '# MerchBase\n\nOld generated content.';
        await writeSkill('merchbase', oldContent);
        getDb()
            .prepare(
                `INSERT INTO skill_sources
                 (skill_id, source, installed_hash, created_at, updated_at)
                 VALUES ('merchbase', 'plugin', $hash, $now, $now)`
            )
            .run({ $hash: sha256(oldContent), $now: new Date().toISOString() });

        await expect(materializePluginSkills({ skillsDir })).resolves.toMatchObject({
            refreshed: ['merchbase'],
        });
        await expect(
            fs.readFile(path.join(skillsDir, 'merchbase', 'SKILL.md'), 'utf8')
        ).resolves.toBe(merchbaseSkillContent());
        expect(readSkillSource('merchbase')?.installedHash).toBe(sha256(merchbaseSkillContent()));

        await fs.appendFile(path.join(skillsDir, 'merchbase', 'SKILL.md'), '\nLocal edit.');
        await expect(materializePluginSkills({ skillsDir })).resolves.toMatchObject({
            refreshed: [],
        });
        await expect(
            fs.readFile(path.join(skillsDir, 'merchbase', 'SKILL.md'), 'utf8')
        ).resolves.toContain('Local edit.');
    });

    it('injects Plugin skills only through the Plugin grant path', async () => {
        enableMerchbasePlugin();
        await materializePluginSkills({ skillsDir });
        await fs.appendFile(path.join(skillsDir, 'merchbase', 'SKILL.md'), '\nEditable guidance.');
        const granted = createAgent({
            enabledPluginIds: [merchbasePluginId],
            enabledSkillIds: ['merchbase'],
            id: 'agt_granted',
        });
        const ungranted = createAgent({
            enabledPluginIds: [],
            enabledSkillIds: ['merchbase'],
            id: 'agt_ungranted',
        });

        const bundles = await readAssignedSkillBundles(granted, { skillsDir });
        expect(bundles.filter((bundle) => bundle.id === 'merchbase')).toHaveLength(1);
        expect(bundles[0]?.content).toContain('Editable guidance.');

        await expect(readAssignedSkillBundles(ungranted, { skillsDir })).resolves.toEqual([]);

        writePluginConfig({ config: {}, enabled: false, id: merchbasePluginId });
        await expect(readAssignedSkillBundles(granted, { skillsDir })).resolves.toEqual([]);
        await expect(fs.stat(path.join(skillsDir, 'merchbase', 'SKILL.md'))).resolves.toBeTruthy();
    });

    it('resets Plugin skills from the manifest', async () => {
        enableMerchbasePlugin();
        await materializePluginSkills({ skillsDir });
        await fs.writeFile(path.join(skillsDir, 'merchbase', 'SKILL.md'), '# Local\n\nEdit.');

        await expect(resetRuntimeSkillToDefault('merchbase', { skillsDir })).resolves.toEqual({
            hash: sha256(merchbaseSkillContent()),
            skillId: 'merchbase',
        });
        await expect(
            fs.readFile(path.join(skillsDir, 'merchbase', 'SKILL.md'), 'utf8')
        ).resolves.toBe(merchbaseSkillContent());
        expect(readSkillSource('merchbase')).toMatchObject({
            installedHash: sha256(merchbaseSkillContent()),
            source: 'plugin',
        });
    });

    it('lists materialized Plugin skills once from disk', async () => {
        enableMerchbasePlugin();
        await materializePluginSkills({ skillsDir });

        const skills = await listRuntimeSkills({ skillsDir });
        expect(skills.filter((skill) => skill.id === 'merchbase')).toHaveLength(1);
        expect(skills).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: 'merchbase',
                    runtimeSource: 'tavern-plugin:merchbase',
                    source: 'installed',
                }),
            ])
        );
        expect(readSkillSource('merchbase')?.source).toBe('plugin');
    });

    it('loads assigned skill content for agent execution', async () => {
        await writeSkill('research', '# Research\n\nCheck primary sources.');
        await fs.mkdir(path.join(skillsDir, 'research', 'references'), {
            recursive: true,
        });
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
        await fs.mkdir(path.join(skillsDir, '.archive', 'old-skill'), {
            recursive: true,
        });
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

    function enableMerchbasePlugin() {
        writePluginConfig({ config: {}, enabled: true, id: merchbasePluginId });
    }

    function merchbaseSkillContent() {
        const match = findPluginServiceForSkill('merchbase');
        if (!match) {
            throw new Error('MerchBase skill manifest is missing.');
        }
        return pluginSkillContent(match.service);
    }

    function createAgent(input: {
        enabledPluginIds: AgentRuntimeAgent['enabledPluginIds'];
        enabledSkillIds: string[];
        id: string;
    }) {
        const agent = {
            enabledPluginIds: input.enabledPluginIds,
            enabledSkillIds: input.enabledSkillIds,
            id: input.id,
            isAdmin: false,
            name: input.id,
            primaryColor: null,
            workspaceFolder: os.tmpdir(),
        } satisfies AgentRuntimeAgent;
        upsertStoredAgent({ agent, syncedAt: '2026-07-06T00:00:00.000Z' });
        return agent;
    }
});
