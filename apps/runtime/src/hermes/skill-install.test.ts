import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { installHubSkill, uninstallHubSkill } from './skill-install';

describe('installHubSkill', () => {
    let home: string;
    let binDir: string;

    beforeEach(async () => {
        home = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-skill-install-home-'));
        binDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-skill-install-bin-'));
    });

    afterEach(async () => {
        await fs.rm(home, { force: true, recursive: true });
        await fs.rm(binDir, { force: true, recursive: true });
    });

    async function writeFakeEngine(script: string) {
        const binaryPath = path.join(binDir, 'hermes');
        await fs.writeFile(binaryPath, `#!/bin/bash\n${script}\n`, { mode: 0o755 });
        return binaryPath;
    }

    it('passes --yes and accepts a source-prefixed lockfile identifier', async () => {
        const binaryPath = await writeFakeEngine(`
echo "args: $@"
if [ "$4" != "--yes" ]; then echo "missing --yes"; exit 2; fi
mkdir -p "$HERMES_HOME/skills/.hub"
cat > "$HERMES_HOME/skills/.hub/lock.json" <<'JSON'
{"version": 1, "installed": {"merchbase": {"identifier": "skills-sh/merchbaseco/skills/skills/merchbase", "source": "skills.sh", "trust_level": "community"}}}
JSON
printf '\\033[1mInstalled\\033[0m merchbase\\n'
`);

        const result = await installHubSkill('merchbaseco/skills/skills/merchbase', {
            binaryPath,
            home,
        });

        expect(result.ok).toBe(true);
        expect(result.exitCode).toBe(0);
        expect(result.log).toContain(
            'args: skills install merchbaseco/skills/skills/merchbase --yes'
        );
        expect(result.log).toContain('Installed merchbase');
    });

    it('reports failure when the engine exits zero without installing', async () => {
        const binaryPath = await writeFakeEngine('echo "Installation cancelled."');

        const result = await installHubSkill('merchbaseco/skills/skills/merchbase', {
            binaryPath,
            home,
        });

        expect(result.ok).toBe(false);
        expect(result.exitCode).toBe(0);
        expect(result.log).toContain('Installation cancelled.');
    });

    it('answers the uninstall confirm prompt and verifies via the lockfile', async () => {
        const lockPath = path.join(home, 'skills', '.hub', 'lock.json');
        await fs.mkdir(path.dirname(lockPath), { recursive: true });
        await fs.writeFile(
            lockPath,
            JSON.stringify({
                installed: {
                    merchbase: {
                        identifier: 'skills-sh/merchbaseco/skills/skills/merchbase',
                        source: 'skills.sh',
                    },
                },
                version: 1,
            }),
            'utf8'
        );
        const binaryPath = await writeFakeEngine(`
read -r answer
if [ "$answer" != "y" ]; then echo "cancelled"; exit 0; fi
cat > "$HERMES_HOME/skills/.hub/lock.json" <<'JSON'
{"version": 1, "installed": {}}
JSON
echo "Uninstalled merchbase"
`);

        const result = await uninstallHubSkill('merchbase', { binaryPath, home });

        expect(result.ok).toBe(true);
        expect(result.log).toContain('Uninstalled merchbase');
    });

    it('reports uninstall failure when the lockfile still has the skill', async () => {
        const lockPath = path.join(home, 'skills', '.hub', 'lock.json');
        await fs.mkdir(path.dirname(lockPath), { recursive: true });
        await fs.writeFile(
            lockPath,
            JSON.stringify({
                installed: { merchbase: { identifier: 'x/y', source: 'github' } },
                version: 1,
            }),
            'utf8'
        );
        const binaryPath = await writeFakeEngine('echo "usage: hermes skills ..."; exit 2');

        const result = await uninstallHubSkill('merchbase', { binaryPath, home });

        expect(result.ok).toBe(false);
        expect(result.exitCode).toBe(2);
    });

    it('reports failure with the log tail when the engine exits non-zero', async () => {
        const binaryPath = await writeFakeEngine('echo "fetch failed" >&2; exit 3');

        const result = await installHubSkill('missing/skill', { binaryPath, home });

        expect(result.ok).toBe(false);
        expect(result.exitCode).toBe(3);
        expect(result.log).toContain('fetch failed');
    });
});
