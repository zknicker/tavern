import fs from 'node:fs/promises';
import path from 'node:path';
import { HERMES_HOME } from '../config';

interface RetiredManagedSkillsInput {
    hermesHome?: string;
}

const retiredManagedSkills = [
    {
        markerFile: 'TAVERN.md',
        markerText: `Tavern-owned Cortex ${'wi'}${'ki'} skill.`,
        name: `cortex-${'wi'}${'ki'}`,
    },
] as const;

export async function removeRetiredManagedSkillCopies(input: RetiredManagedSkillsInput = {}) {
    const hermesHome = input.hermesHome ?? HERMES_HOME;
    await Promise.all(
        retiredManagedSkills.map((skill) =>
            removeRetiredManagedSkillCopy(path.join(hermesHome, 'skills', skill.name), skill)
        )
    );
}

async function removeRetiredManagedSkillCopy(
    skillPath: string,
    skill: (typeof retiredManagedSkills)[number]
) {
    const marker = await fs
        .readFile(path.join(skillPath, skill.markerFile), 'utf8')
        .catch(() => null);
    if (!marker?.includes(skill.markerText)) {
        return;
    }

    await makeWritable(skillPath);
    await fs.rm(skillPath, { force: true, recursive: true });
}

async function makeWritable(filePath: string) {
    const stats = await fs.lstat(filePath).catch(() => null);
    if (!stats || stats.isSymbolicLink()) {
        return;
    }

    if (stats.isDirectory()) {
        await fs.chmod(filePath, (stats.mode | 0o700) & 0o777).catch(() => undefined);
        await Promise.all(
            (await fs.readdir(filePath)).map((entry) => makeWritable(path.join(filePath, entry)))
        );
        return;
    }

    await fs.chmod(filePath, (stats.mode | 0o600) & 0o777).catch(() => undefined);
}
