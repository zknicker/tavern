import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
    ensureManagedMerchbaseSkill,
    getMerchbaseSkillConflict,
    managedMerchbaseSkillMarkerFile,
} from './merchbase-skill.ts';

const tempDirs: string[] = [];

afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => removeWritable(dir)));
});

describe('managed MerchBase skill', () => {
    it('installs the skill into the managed skills directory', async () => {
        const hermesHome = await makeTempDir();

        const { skillPath } = await ensureManagedMerchbaseSkill({ hermesHome });
        const skill = await fs.readFile(path.join(skillPath, 'SKILL.md'), 'utf8');

        expect(skillPath).toBe(path.join(hermesHome, 'skills', 'merchbase'));
        expect(skill).toContain('name: merchbase');
        expect(skill).toContain('Managed by Tavern Runtime');
        expect(skill).toContain('Use the `merchbase` toolset');
        expect(skill).toContain('merchbase_products_search');
        expect(skill).toContain('merchbase_sales_summary');
        expect(skill).not.toContain('/integrations/merchbase/action');
        expect(skill).not.toContain('curl');
        expect(skill).not.toContain('TAVERN_RUNTIME_TOKEN');
        expect(skill).toContain('MerchBaseSalesChart');
        expect(skill).toContain('Settings -> Integrations');
        await expect(
            fs.readFile(path.join(skillPath, managedMerchbaseSkillMarkerFile), 'utf8')
        ).resolves.toContain('tavern-integration:merchbase');
        await expectOwnerWriteDisabled(skillPath);
        await expectOwnerWriteDisabled(path.join(skillPath, 'SKILL.md'));
    });

    it('does not replace an existing user-owned merchbase skill', async () => {
        const hermesHome = await makeTempDir();
        const skillPath = path.join(hermesHome, 'skills', 'merchbase');
        await fs.mkdir(skillPath, { recursive: true });
        await fs.writeFile(
            path.join(skillPath, 'SKILL.md'),
            '---\nname: merchbase\n---\n\nUser owned instructions.\n'
        );

        const result = await ensureManagedMerchbaseSkill({ hermesHome });

        expect(result).toEqual({ installed: false, skillPath });
        await expect(fs.readFile(path.join(skillPath, 'SKILL.md'), 'utf8')).resolves.toContain(
            'User owned instructions.'
        );
        await expect(
            fs.stat(path.join(skillPath, managedMerchbaseSkillMarkerFile))
        ).rejects.toThrow();
    });

    it('replaces an existing user-owned merchbase skill when explicitly requested', async () => {
        const hermesHome = await makeTempDir();
        const skillPath = path.join(hermesHome, 'skills', 'merchbase');
        await fs.mkdir(skillPath, { recursive: true });
        await fs.writeFile(
            path.join(skillPath, 'SKILL.md'),
            '---\nname: merchbase\n---\n\nUser owned instructions.\n'
        );

        expect(getMerchbaseSkillConflict({ hermesHome })).toEqual({
            skillName: 'merchbase',
            skillPath,
        });

        const result = await ensureManagedMerchbaseSkill({ hermesHome, replaceExisting: true });

        expect(result).toEqual({ installed: true, skillPath });
        await expect(fs.readFile(path.join(skillPath, 'SKILL.md'), 'utf8')).resolves.toContain(
            'Managed by Tavern Runtime'
        );
        await expect(
            fs.readFile(path.join(skillPath, managedMerchbaseSkillMarkerFile), 'utf8')
        ).resolves.toContain('tavern-integration:merchbase');
        expect(getMerchbaseSkillConflict({ hermesHome })).toBeNull();
    });
});

async function expectOwnerWriteDisabled(filePath: string) {
    const mode = (await fs.stat(filePath)).mode;
    expect(mode & 0o200).toBe(0);
}

async function makeTempDir() {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'merchbase-skill-'));
    tempDirs.push(directory);
    return directory;
}

async function removeWritable(filePath: string) {
    await makeWritable(filePath);
    await fs.rm(filePath, { force: true, recursive: true });
}

async function makeWritable(filePath: string) {
    const stats = await fs.lstat(filePath).catch(() => null);
    if (!stats || stats.isSymbolicLink()) {
        return;
    }

    if (stats.isDirectory()) {
        await fs.chmod(filePath, 0o700).catch(() => undefined);
        await Promise.all(
            (await fs.readdir(filePath)).map((entry) => makeWritable(path.join(filePath, entry)))
        );
        return;
    }

    await fs.chmod(filePath, 0o600).catch(() => undefined);
}
