import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ensureManagedTavernSkill } from './tavern-skill';

describe('managed tavern skill', () => {
    it('installs the skill into the managed skills directory', async () => {
        const hermesHome = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-skill-'));

        const { skillPath } = await ensureManagedTavernSkill({ hermesHome });
        const skill = await fs.readFile(path.join(skillPath, 'SKILL.md'), 'utf8');

        expect(skillPath).toBe(path.join(hermesHome, 'skills', 'tavern'));
        expect(skill).toContain('name: tavern');
        expect(skill).toContain('$TAVERN_RUNTIME_URL/api/chats');
        expect(skill).not.toContain('/cron/deliveries');
        expect(skill).not.toContain('## Automations');
        expect(skill).not.toContain('## Assistant Memory');
        expect(skill).not.toContain('memory_remember');
        expect(skill).toContain('Vault status');
        expect(skill).toContain('Settings -> Connectors');
    });

    it('refreshes managed content on reinstall', async () => {
        const hermesHome = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-skill-'));
        const { skillPath } = await ensureManagedTavernSkill({ hermesHome });
        await fs.writeFile(path.join(skillPath, 'SKILL.md'), 'stale local edit');

        await ensureManagedTavernSkill({ hermesHome });

        await expect(fs.readFile(path.join(skillPath, 'SKILL.md'), 'utf8')).resolves.toContain(
            'name: tavern'
        );
    });

    it('keeps skill copy in product language', async () => {
        const hermesHome = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-skill-'));
        const { skillPath } = await ensureManagedTavernSkill({ hermesHome });

        const skill = await fs.readFile(path.join(skillPath, 'SKILL.md'), 'utf8');
        expect(skill).not.toMatch(/hermes/iu);
    });
});
