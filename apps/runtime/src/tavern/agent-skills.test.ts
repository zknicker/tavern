import fs from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { recordSkillSource } from '../skills/store.ts';
import { closeAgentApiTestDb, initAgentApiTestDb } from './agent-api-test-helper.ts';
import {
    createAgentAuthoredSkill,
    listAgentSkills,
    patchAgentSkill,
    viewAgentSkill,
    writeAgentSkillFile,
} from './agent-skills.ts';
import { upsertStoredAgent } from './agents-store.ts';

describe('agent skill ownership and paths', () => {
    let root: string;
    let skillsDir: string;

    beforeEach(async () => {
        root = initAgentApiTestDb('tavern-agent-skills-');
        skillsDir = path.join(root, 'skills');
        await fs.mkdir(skillsDir, { recursive: true });
        seedAgent('agt_one', 'One');
        seedAgent('agt_two', 'Two');
        await fs.mkdir(path.join(skillsDir, 'seeded'), { recursive: true });
        await fs.writeFile(path.join(skillsDir, 'seeded', 'SKILL.md'), '# Seeded\n');
        recordSkillSource({ skillId: 'seeded', source: 'seeded' });
    });

    afterEach(async () => await closeAgentApiTestDb(root));

    it('lets creators patch their own skills and rejects other agents and seeded skills', async () => {
        await createAgentAuthoredSkill(
            'agt_one',
            {
                content: '# Audit\n',
                description: 'Audit',
                name: 'audit',
            },
            skillsDir
        );
        const viewed = await viewAgentSkill('agt_one', 'audit', skillsDir);
        await expect(
            patchAgentSkill(
                'agt_one',
                {
                    content: '# Audit\n\nBe exact.\n',
                    expectedHash: viewed.hash,
                    skillId: 'audit',
                },
                skillsDir
            )
        ).resolves.toMatchObject({ change: { skillId: 'audit' } });
        await expect(
            patchAgentSkill(
                'agt_two',
                {
                    content: '# Stolen\n',
                    expectedHash: viewed.hash,
                    skillId: 'audit',
                },
                skillsDir
            )
        ).rejects.toMatchObject({ code: 'SKILL_NOT_EDITABLE' });

        const seeded = await viewAgentSkill('agt_one', 'seeded', skillsDir);
        await expect(
            patchAgentSkill(
                'agt_one',
                {
                    content: '# Changed\n',
                    expectedHash: seeded.hash,
                    skillId: 'seeded',
                },
                skillsDir
            )
        ).rejects.toMatchObject({ code: 'SKILL_NOT_EDITABLE' });
    });

    it('marks only caller-authored skills editable', async () => {
        await createAgentAuthoredSkill(
            'agt_one',
            { content: '# One\n', description: 'One', name: 'one' },
            skillsDir
        );
        await createAgentAuthoredSkill(
            'agt_two',
            { content: '# Two\n', description: 'Two', name: 'two' },
            skillsDir
        );

        const skills = (await listAgentSkills('agt_one', skillsDir)).skills;
        expect(skills.find((skill) => skill.id === 'one')?.editable).toBe(true);
        expect(skills.find((skill) => skill.id === 'two')?.editable).toBe(false);
        expect(skills.find((skill) => skill.id === 'seeded')?.editable).toBe(false);
    });

    it('rejects traversal and multi-segment skill ids', async () => {
        await expect(viewAgentSkill('agt_one', '../../x', skillsDir)).rejects.toMatchObject({
            code: 'INVALID_ARG',
        });
        await expect(viewAgentSkill('agt_one', 'a/b', skillsDir)).rejects.toMatchObject({
            code: 'INVALID_ARG',
        });
    });

    it('rejects cross-skill symlinks for patches and support files', async () => {
        await createAgentAuthoredSkill(
            'agt_one',
            { content: '# One\n', description: 'One', name: 'one' },
            skillsDir
        );
        await createAgentAuthoredSkill(
            'agt_two',
            { content: '# Two\n', description: 'Two', name: 'two' },
            skillsDir
        );
        const two = await viewAgentSkill('agt_two', 'two', skillsDir);
        await fs.rm(path.join(skillsDir, 'one', 'SKILL.md'));
        await fs.symlink(
            path.join(skillsDir, 'two', 'SKILL.md'),
            path.join(skillsDir, 'one', 'SKILL.md')
        );

        await expect(
            patchAgentSkill(
                'agt_one',
                {
                    content: '# Stolen\n',
                    expectedHash: two.hash,
                    skillId: 'one',
                },
                skillsDir
            )
        ).rejects.toMatchObject({ code: 'SKILL_PATCH_FAILED' });

        await fs.mkdir(path.join(skillsDir, 'two', 'references'));
        await fs.symlink(
            path.join(skillsDir, 'two', 'references'),
            path.join(skillsDir, 'one', 'references')
        );
        await expect(
            writeAgentSkillFile(
                'agt_one',
                {
                    content: 'stolen',
                    expectedHash: null,
                    filePath: 'references/stolen.md',
                    skillId: 'one',
                },
                skillsDir
            )
        ).rejects.toMatchObject({ code: 'SKILL_WRITE_FAILED' });

        await fs.symlink(path.join(skillsDir, 'two'), path.join(skillsDir, 'alias'));
        recordSkillSource({
            createdByAgentId: 'agt_one',
            skillId: 'alias',
            source: 'agent',
        });
        await expect(
            patchAgentSkill(
                'agt_one',
                {
                    content: '# Stolen\n',
                    expectedHash: two.hash,
                    skillId: 'alias',
                },
                skillsDir
            )
        ).rejects.toMatchObject({ code: 'SKILL_PATCH_FAILED' });
    });

    function seedAgent(id: string, name: string) {
        upsertStoredAgent({
            agent: {
                enabledSkillIds: [],
                id,
                isAdmin: false,
                name,
                primaryColor: null,
                workspaceFolder: root,
            },
        });
    }
});
