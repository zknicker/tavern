import { afterEach, test } from 'bun:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ensureDatabaseSchema } from '../src/db/bootstrap.ts';
import { databaseClient } from '../src/db/index.ts';
import * as skillService from '../src/skills/service.ts';
import {
    getSkillPackage,
    replaceAgentSkillSelections,
    saveAgentSkillSyncState,
    saveSkillPackage,
} from '../src/skills/storage.ts';
import { syncAgentsForRuntime } from '../src/storage/agents.ts';

ensureDatabaseSchema();

const tempDirs: string[] = [];

afterEach(async () => {
    databaseClient.exec('DELETE FROM agent_skill_selections;');
    databaseClient.exec('DELETE FROM skill_packages;');
    databaseClient.exec('DELETE FROM agents;');
    for (const directory of tempDirs.splice(0)) {
        await rm(directory, { force: true, recursive: true });
    }
});

test('listSkills and getSkill read Tavern-managed skill packages', async () => {
    const cachePath = await createCachedSkill({
        content: `---
name: pdf
description: Read and summarize PDFs
allowed-tools: Read
metadata:
  license: internal
  clawdbot:
    requires:
      bins:
        - pdf-cli
---
# PDF
`,
    });
    await saveTestPackage({ cachePath, id: 'skill-pdf' });

    const listed = await skillService.listSkills();
    const loaded = await skillService.getSkill({ skillId: 'skill-pdf' });

    assert.equal(listed.skills.length, 1);
    assert.equal(listed.skills[0]?.id, 'skill-pdf');
    assert.equal(listed.skills[0]?.dependencyState, 'unknown');
    assert.equal('files' in (listed.skills[0] ?? {}), false);
    assert.equal('runtimeName' in (listed.skills[0] ?? {}), false);
    assert.equal('runtimeSkillId' in (listed.skills[0] ?? {}), false);
    assert.equal('source' in (listed.skills[0] ?? {}), false);
    assert.equal(loaded.skill?.name, 'pdf');
    assert.equal(loaded.skill?.installSource?.source, 'github');
    assert.deepEqual(loaded.skill?.metadata, {
        clawdbot: {
            requires: {
                bins: ['pdf-cli'],
            },
        },
        license: 'internal',
    });
    assert.equal(loaded.skill?.files[0]?.path, 'SKILL.md');
    assert.match(loaded.skill?.bodyMarkdown ?? '', /# PDF/u);
});

test('getSkill includes per-agent OpenClaw dependency status', async () => {
    const cachePath = await createCachedSkill({
        content: `---
name: gog
description: Google Workspace CLI
metadata:
  clawdbot:
    install:
      - id: brew
        kind: brew
        formula: steipete/tap/gogcli
        bins:
          - gog
        label: Install gog (brew)
---
# gog
`,
    });
    await saveTestPackage({ cachePath, id: 'skill-gog' });
    const skillPackage = await getSkillPackage('skill-gog');
    assert.ok(skillPackage);
    await syncAgentsForRuntime({
        agents: [
            {
                avatar: null,
                enabledSkillIds: ['skill-gog'],
                emoji: null,
                id: 'main',
                isAdmin: false,
                name: 'main',
                primaryColor: null,
                workspaceFolder: '/tmp/openclaw/workspace',
            },
        ],
        runtimeId: 'runtime-a',
        syncedAt: '2026-05-07T17:00:00.000Z',
    });
    await replaceAgentSkillSelections({
        agentId: 'main',
        packages: [{ materializedName: 'gog', package: skillPackage }],
    });
    await saveAgentSkillSyncState({
        agentId: 'main',
        observedJson: JSON.stringify({
            allowedTools: null,
            baseDir: '/tmp/openclaw/workspace/skills/gog',
            commandVisible: false,
            configChecks: [],
            description: 'Google Workspace CLI',
            eligible: false,
            id: 'gog',
            install: [],
            missing: { anyBins: [], bins: ['gog'], config: [], env: [], os: [] },
            modelVisible: false,
            name: 'gog',
            requirements: { anyBins: [], bins: ['gog'], config: [], env: [], os: [] },
            runtimeSource: 'openclaw-workspace',
            source: 'installed',
            updatedAt: null,
        }),
        skillPackageId: 'skill-gog',
        syncError: 'Missing requirements (bins: gog).',
    });

    const loaded = await skillService.getSkill({ skillId: 'skill-gog' });

    assert.equal(loaded.skill?.agentCount, 1);
    assert.equal(loaded.skill?.assignedAgents[0]?.agentName, 'main');
    assert.equal(loaded.skill?.assignedAgents[0]?.agentAvatar, 'M');
    assert.equal(loaded.skill?.assignedAgents[0]?.dependencyState, 'missing');
    assert.deepEqual(loaded.skill?.assignedAgents[0]?.requirements.bins, ['gog']);
    assert.deepEqual(loaded.skill?.assignedAgents[0]?.missing.bins, ['gog']);
    assert.deepEqual(loaded.skill?.setupCommands, [
        {
            bins: ['gog'],
            command: 'brew install steipete/tap/gogcli',
            id: 'brew',
            label: 'Install gog (brew)',
        },
    ]);
});

test('checkSkillForUpdates stores ClawHub latest version metadata', async () => {
    const cachePath = await createCachedSkill({
        content: '---\nname: gog\ndescription: Google Workspace CLI\n---\n# gog\n',
    });
    await saveTestPackage({
        cachePath,
        id: 'skill-gog',
        installSource: { source: 'clawhub', spec: 'gog', version: '1.0.0' },
        resolvedVersion: '1.0.0',
        sourceSpec: 'gog',
        sourceType: 'clawhub',
    });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
        new Response(
            JSON.stringify({
                latestVersion: {
                    createdAt: 1_778_174_498_299,
                    version: '1.1.0',
                },
                skill: {
                    updatedAt: 1_778_176_606_933,
                },
            }),
            { status: 200 }
        );

    try {
        const result = await skillService.checkSkillForUpdates({ skillId: 'skill-gog' });

        assert.equal(result.skill.latestVersion, '1.1.0');
        assert.equal(result.skill.updateAvailable, true);
        assert.equal(result.skill.updateError, null);
        assert.ok(result.skill.updateCheckedAt);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('deleteSkill removes an Tavern-managed package from the registry', async () => {
    const cachePath = await createCachedSkill({
        content: '---\nname: pdf\n---\n# PDF\n',
    });
    await saveTestPackage({ cachePath, id: 'skill-pdf' });

    const deleted = await skillService.deleteSkill({ skillId: 'skill-pdf' });
    const listed = await skillService.listSkills();

    assert.equal(deleted.deleted, true);
    assert.deepEqual(listed.skills, []);
});

async function createCachedSkill(input: { content: string }) {
    const directory = await mkdtemp(join(tmpdir(), 'tavern-skill-service-test-'));
    tempDirs.push(directory);
    await writeFile(join(directory, 'SKILL.md'), input.content);
    return directory;
}

async function saveTestPackage(input: {
    cachePath: string;
    id: string;
    installSource?:
        | { source: 'clawhub'; spec: string; version: string }
        | {
              ref: null;
              source: 'github';
              spec: string;
          };
    resolvedVersion?: string;
    sourceSpec?: string;
    sourceType?: string;
}) {
    await saveSkillPackage({
        allowedTools: 'Read',
        cachePath: input.cachePath,
        contentHash: 'sha256:test',
        description: 'Read and summarize PDFs',
        displayName: 'pdf',
        filesJson: JSON.stringify([{ path: 'SKILL.md', sizeBytes: 42 }]),
        id: input.id,
        installSourceJson: JSON.stringify(
            input.installSource ?? {
                ref: null,
                source: 'github',
                spec: 'owner/repo/pdf',
            }
        ),
        metadataJson: '{}',
        resolvedVersion: input.resolvedVersion ?? 'commit',
        skillName: 'pdf',
        sourceSpec: input.sourceSpec ?? 'owner/repo/pdf',
        sourceType: input.sourceType ?? 'github',
        sourceVersion: null,
    });
}
