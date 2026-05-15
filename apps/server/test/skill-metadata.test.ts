import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readSkillInstallOptions, readSkillSecretEnvNames } from '../src/skills/metadata.ts';

test('readSkillSecretEnvNames supports OpenClaw and Clawdbot metadata', () => {
    assert.deepEqual(
        readSkillSecretEnvNames({
            clawdbot: {
                primaryEnv: 'GITHUB_TOKEN',
                requires: {
                    env: ['LINEAR_API_KEY', 'GITHUB_TOKEN'],
                },
            },
            openclaw: {
                primaryEnv: 'OPENAI_API_KEY',
                requires: {
                    env: ['ANTHROPIC_API_KEY'],
                },
            },
        }),
        ['ANTHROPIC_API_KEY', 'GITHUB_TOKEN', 'LINEAR_API_KEY', 'OPENAI_API_KEY']
    );
});

test('readSkillInstallOptions preserves sandbox install metadata', () => {
    assert.deepEqual(
        readSkillInstallOptions({
            openclaw: {
                install: [
                    {
                        bins: ['tsx'],
                        id: 'tsx',
                        kind: 'node',
                        label: 'tsx',
                        package: 'tsx',
                    },
                    {
                        bins: ['gh'],
                        id: 'github-cli',
                        kind: 'brew',
                        label: 'GitHub CLI',
                        formula: 'gh',
                    },
                ],
            },
        }),
        [
            {
                bins: ['tsx'],
                command: null,
                formula: null,
                id: 'tsx',
                kind: 'node',
                label: 'tsx',
                module: null,
                packageName: 'tsx',
            },
            {
                bins: ['gh'],
                command: null,
                formula: 'gh',
                id: 'github-cli',
                kind: 'brew',
                label: 'GitHub CLI',
                module: null,
                packageName: null,
            },
        ]
    );
});
