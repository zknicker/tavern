import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ensureManagedTavernSkill } from './tavern-skill';

const tempDirs: string[] = [];

afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => removeWritable(dir)));
});

describe('managed tavern skill', () => {
    it('installs the skill into the managed skills directory', async () => {
        const hermesHome = await makeTempDir();

        const { skillPath } = await ensureManagedTavernSkill({ hermesHome });
        const skill = await fs.readFile(path.join(skillPath, 'SKILL.md'), 'utf8');

        expect(skillPath).toBe(path.join(hermesHome, 'skills', 'tavern'));
        expect(skill).toContain('name: tavern');
        expect(skill).toContain('Managed by Tavern Runtime');
        expect(skill).toContain('$TAVERN_RUNTIME_URL/api/chats');
        expect(skill).not.toContain('/cron/deliveries');
        expect(skill).not.toContain('## Automations');
        expect(skill).not.toContain('## Assistant Memory');
        expect(skill).toContain('Vault status');
        expect(skill).toContain('Settings -> Connectors');
        await expectOwnerWriteDisabled(skillPath);
        await expectOwnerWriteDisabled(path.join(skillPath, 'SKILL.md'));
    });

    it('refreshes managed content on reinstall', async () => {
        const hermesHome = await makeTempDir();
        const { skillPath } = await ensureManagedTavernSkill({ hermesHome });
        await fs.chmod(skillPath, 0o700);
        await fs.chmod(path.join(skillPath, 'SKILL.md'), 0o600);
        await fs.writeFile(path.join(skillPath, 'SKILL.md'), 'stale local edit');

        await ensureManagedTavernSkill({ hermesHome });

        await expect(fs.readFile(path.join(skillPath, 'SKILL.md'), 'utf8')).resolves.toContain(
            'name: tavern'
        );
        await expectOwnerWriteDisabled(skillPath);
        await expectOwnerWriteDisabled(path.join(skillPath, 'SKILL.md'));
    });

    it('keeps skill copy in product language', async () => {
        const hermesHome = await makeTempDir();
        const { skillPath } = await ensureManagedTavernSkill({ hermesHome });

        const skill = await fs.readFile(path.join(skillPath, 'SKILL.md'), 'utf8');
        expect(skill).not.toMatch(/hermes/iu);
    });
});

async function expectOwnerWriteDisabled(filePath: string) {
    const mode = (await fs.stat(filePath)).mode;
    expect(mode & 0o200).toBe(0);
}

async function makeTempDir() {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-skill-'));
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
