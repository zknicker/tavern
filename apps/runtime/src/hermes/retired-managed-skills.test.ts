import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { removeRetiredManagedSkillCopies } from './retired-managed-skills';

const tempDirs: string[] = [];

afterEach(async () => {
    await Promise.all(
        tempDirs.splice(0).map((dir) => fs.rm(dir, { force: true, recursive: true }))
    );
});

describe('retired managed skills', () => {
    it('removes stale Tavern-owned Cortex wiki skill copies', async () => {
        const hermesHome = await makeTempDir();
        const skillPath = path.join(hermesHome, 'skills', 'cortex-wiki');
        await fs.mkdir(skillPath, { recursive: true });
        await fs.writeFile(path.join(skillPath, 'TAVERN.md'), 'Tavern-owned Cortex wiki skill.\n');
        await fs.chmod(path.join(skillPath, 'TAVERN.md'), 0o400);
        await fs.chmod(skillPath, 0o500);

        await removeRetiredManagedSkillCopies({ hermesHome });

        await expect(fs.stat(skillPath)).rejects.toMatchObject({ code: 'ENOENT' });
    });

    it('leaves user-owned skill copies with the same directory name alone', async () => {
        const hermesHome = await makeTempDir();
        const skillPath = path.join(hermesHome, 'skills', 'cortex-wiki');
        await fs.mkdir(skillPath, { recursive: true });
        await fs.writeFile(path.join(skillPath, 'SKILL.md'), '---\nname: cortex-wiki\n---\n');

        await removeRetiredManagedSkillCopies({ hermesHome });

        await expect(fs.readFile(path.join(skillPath, 'SKILL.md'), 'utf8')).resolves.toContain(
            'name: cortex-wiki'
        );
    });
});

async function makeTempDir() {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-retired-skill-'));
    tempDirs.push(directory);
    return directory;
}
