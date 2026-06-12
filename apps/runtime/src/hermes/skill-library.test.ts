import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
    findInstalledHubEntry,
    listBuiltinLibrarySkills,
    readInstalledHubSkills,
} from './skill-library';

describe('skill library', () => {
    let engineSourceDir: string;
    let home: string;

    beforeEach(async () => {
        engineSourceDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-engine-src-'));
        home = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-skill-library-'));
    });

    afterEach(async () => {
        await fs.rm(engineSourceDir, { force: true, recursive: true });
        await fs.rm(home, { force: true, recursive: true });
    });

    async function writeOptionalSkill(relDir: string, description: string) {
        const dir = path.join(engineSourceDir, 'optional-skills', relDir);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(
            path.join(dir, 'SKILL.md'),
            `---\nname: ${path.basename(relDir)}\ndescription: ${description}\n---\n`,
            'utf8'
        );
    }

    it('lists vendored optional skills with official identifiers', async () => {
        await writeOptionalSkill('agentmail', 'Dedicated agent email inbox');
        await writeOptionalSkill('data/axolotl', 'YAML LLM fine-tuning');
        await fs.mkdir(path.join(engineSourceDir, 'optional-skills', '__pycache__'), {
            recursive: true,
        });

        const items = await listBuiltinLibrarySkills({ engineSourceDir });

        expect(items).toEqual([
            {
                description: 'Dedicated agent email inbox',
                identifier: 'official/agentmail',
                name: 'agentmail',
                repo: null,
                source: 'official',
                tags: [],
                trustLevel: 'builtin',
            },
            {
                description: 'YAML LLM fine-tuning',
                identifier: 'official/data/axolotl',
                name: 'axolotl',
                repo: null,
                source: 'official',
                tags: [],
                trustLevel: 'builtin',
            },
        ]);
    });

    it('returns no built-ins when the engine source has no library', async () => {
        expect(await listBuiltinLibrarySkills({ engineSourceDir })).toEqual([]);
    });

    it('maps the engine lockfile to an identifier-keyed installed map', async () => {
        const lockPath = path.join(home, 'skills', '.hub', 'lock.json');
        await fs.mkdir(path.dirname(lockPath), { recursive: true });
        await fs.writeFile(
            lockPath,
            JSON.stringify({
                installed: {
                    merchbase: {
                        identifier: 'merchbaseco/skills/skills/merchbase',
                        scan_verdict: 'clean',
                        source: 'github',
                        trust_level: 'community',
                    },
                    broken: { source: 'github' },
                },
                version: 1,
            }),
            'utf8'
        );

        const installed = await readInstalledHubSkills({ home });

        expect(installed).toEqual({
            'merchbaseco/skills/skills/merchbase': {
                name: 'merchbase',
                scanVerdict: 'clean',
                trustLevel: 'community',
            },
        });
    });

    it('returns an empty installed map without a lockfile', async () => {
        expect(await readInstalledHubSkills({ home })).toEqual({});
    });

    it('matches installed entries across engine source prefixes', () => {
        const installed = {
            'skills-sh/merchbaseco/skills/skills/merchbase': {
                name: 'merchbase',
                scanVerdict: 'safe',
                trustLevel: 'community',
            },
        };

        expect(findInstalledHubEntry('merchbaseco/skills/skills/merchbase', installed)?.name).toBe(
            'merchbase'
        );
        expect(
            findInstalledHubEntry('skills-sh/merchbaseco/skills/skills/merchbase', installed)?.name
        ).toBe('merchbase');
        expect(findInstalledHubEntry('skills/merchbase', installed)).toBeUndefined();
        expect(findInstalledHubEntry('official/merchbase', installed)).toBeUndefined();
    });
});
