import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { addSkillHubTap, listSkillHubTaps, removeSkillHubTap } from './skill-taps';

describe('skill hub taps', () => {
    let home: string;

    beforeEach(async () => {
        home = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-skill-taps-'));
    });

    afterEach(async () => {
        await fs.rm(home, { force: true, recursive: true });
    });

    it('returns no taps when the engine has no taps file', async () => {
        expect(await listSkillHubTaps({ home })).toEqual({ taps: [] });
    });

    it('adds a tap and writes the engine taps.json shape', async () => {
        const result = await addSkillHubTap({ repo: 'merchbaseco/skills' }, { home });

        expect(result.taps).toEqual([{ path: 'skills/', repo: 'merchbaseco/skills' }]);
        const raw = JSON.parse(
            await fs.readFile(path.join(home, 'skills', '.hub', 'taps.json'), 'utf8')
        );
        expect(raw).toEqual({ taps: [{ path: 'skills/', repo: 'merchbaseco/skills' }] });
    });

    it('rejects duplicate repos and invalid repo formats', async () => {
        await addSkillHubTap({ repo: 'merchbaseco/skills' }, { home });

        await expect(addSkillHubTap({ repo: 'merchbaseco/skills' }, { home })).rejects.toThrow(
            'already configured'
        );
        await expect(addSkillHubTap({ repo: 'not-a-repo' }, { home })).rejects.toThrow();
    });

    it('removes a tap and preserves the others', async () => {
        await addSkillHubTap({ repo: 'merchbaseco/skills' }, { home });
        await addSkillHubTap({ path: 'packs/', repo: 'merchbaseco/extra' }, { home });

        const result = await removeSkillHubTap('merchbaseco/skills', { home });

        expect(result.taps).toEqual([{ path: 'packs/', repo: 'merchbaseco/extra' }]);
        await expect(removeSkillHubTap('merchbaseco/skills', { home })).rejects.toThrow(
            'not configured'
        );
    });

    it('keeps valid taps when the file holds entries it cannot parse', async () => {
        const filePath = path.join(home, 'skills', '.hub', 'taps.json');
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(
            filePath,
            JSON.stringify({
                taps: [{ repo: 'merchbaseco/skills' }, { repo: 42 }, 'garbage'],
            }),
            'utf8'
        );

        const result = await listSkillHubTaps({ home });

        expect(result.taps).toEqual([{ path: 'skills/', repo: 'merchbaseco/skills' }]);
    });
});
