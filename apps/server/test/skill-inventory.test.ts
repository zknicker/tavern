import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const directory = mkdtempSync(join(tmpdir(), 'tavern-skill-inventory-'));
process.env.DATABASE_PATH = join(directory, 'test.sqlite');

const { filterRuntimeVisibleSkills } = await import('../src/skills/service.ts');

test('filterRuntimeVisibleSkills hides skills blocked by runtime policy', () => {
    const visible = filterRuntimeVisibleSkills([
        {
            blockedByAllowlist: true,
            description: 'Bundled skill blocked by managed Runtime config',
            eligible: false,
            id: 'github',
            install: [],
            missing: { anyBins: [], bins: [], config: [], env: [], os: [] },
            name: 'github',
            requirements: { anyBins: [], bins: [], config: [], env: [], os: [] },
            runtimeSource: 'hermes-bundled',
            source: 'builtin',
            updatedAt: null,
        },
        {
            description: 'Personal browser workflow',
            eligible: true,
            id: 'agent-browser',
            install: [],
            missing: { anyBins: [], bins: [], config: [], env: [], os: [] },
            name: 'agent-browser',
            requirements: { anyBins: [], bins: [], config: [], env: [], os: [] },
            runtimeSource: 'agents-skills-personal',
            source: 'installed',
            updatedAt: null,
        },
    ]);

    assert.deepEqual(
        visible.map((skill) => skill.id),
        ['agent-browser']
    );
});
