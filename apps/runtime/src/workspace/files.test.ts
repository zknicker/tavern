import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { closeDb, getDb, initTestDb } from '../db/connection';
import { ensureRuntimeSchema } from '../db/schema';
import { listWorkspaceFiles, readWorkspaceFile } from './files';
import { registerAgentWorkspace } from './instructions';

describe('workspace files', () => {
    let outsideDir: string;
    let workspaceDir: string;

    beforeEach(async () => {
        workspaceDir = await mkdtemp(path.join(tmpdir(), 'tavern-workspace-files-'));
        outsideDir = await mkdtemp(path.join(tmpdir(), 'tavern-workspace-outside-'));
        ensureRuntimeSchema(initTestDb());
        registerAgentWorkspace(getDb(), {
            agentId: 'planner',
            agentName: 'Planner',
            workspaceDir,
        });
    });

    afterEach(async () => {
        closeDb();
        await rm(workspaceDir, { force: true, recursive: true });
        await rm(outsideDir, { force: true, recursive: true });
    });

    test('lists visible workspace files with directories first', async () => {
        await mkdir(path.join(workspaceDir, 'docs'));
        await mkdir(path.join(workspaceDir, 'node_modules'));
        await writeFile(path.join(workspaceDir, 'README.md'), '# Hello');
        await writeFile(path.join(workspaceDir, '.env'), 'SECRET=1');
        await writeFile(path.join(workspaceDir, 'docs', 'plan.html'), '<h1>Plan</h1>');

        const root = await listWorkspaceFiles(getDb(), { agentId: 'planner', path: '' });
        const docs = await listWorkspaceFiles(getDb(), { agentId: 'planner', path: 'docs' });

        expect(root.entries.map((entry) => entry.path)).toEqual(['docs', 'README.md']);
        expect(root.entries[0]).toMatchObject({ kind: 'directory', mediaType: null });
        expect(root.entries[1]).toMatchObject({
            kind: 'file',
            mediaType: 'text/markdown',
            sizeBytes: 7,
        });
        expect(docs.entries).toMatchObject([
            { kind: 'file', mediaType: 'text/html', name: 'plan.html', path: 'docs/plan.html' },
        ]);
    });

    test('reads markdown, html, and image content from the registered workspace', async () => {
        await mkdir(path.join(workspaceDir, 'out'));
        await writeFile(path.join(workspaceDir, 'notes.md'), '# Notes');
        await writeFile(path.join(workspaceDir, 'out', 'preview.html'), '<h1>Preview</h1>');
        await writeFile(path.join(workspaceDir, 'pixel.png'), Buffer.from([137, 80, 78, 71]));

        await expect(
            readWorkspaceFile(getDb(), { agentId: 'planner', path: 'notes.md' })
        ).resolves.toMatchObject({
            binary: false,
            content: '# Notes',
            encoding: 'utf8',
            mediaType: 'text/markdown',
        });
        await expect(
            readWorkspaceFile(getDb(), { agentId: 'planner', path: 'out/preview.html' })
        ).resolves.toMatchObject({
            binary: false,
            content: '<h1>Preview</h1>',
            mediaType: 'text/html',
        });
        await expect(
            readWorkspaceFile(getDb(), { agentId: 'planner', path: 'pixel.png' })
        ).resolves.toMatchObject({
            binary: true,
            content: 'iVBORw==',
            encoding: 'base64',
            mediaType: 'image/png',
        });
    });

    test('rejects traversal, symlinks, and sensitive files', async () => {
        await writeFile(path.join(workspaceDir, '.env'), 'SECRET=1');
        await writeFile(path.join(outsideDir, 'secret.md'), '# Secret');
        await symlink(
            path.join(outsideDir, 'secret.md'),
            path.join(workspaceDir, 'secret-link.md')
        );

        await expect(
            readWorkspaceFile(getDb(), { agentId: 'planner', path: '../secret.md' })
        ).rejects.toThrow(/inside the workspace|required|relative/u);
        await expect(
            readWorkspaceFile(getDb(), { agentId: 'planner', path: '.env' })
        ).rejects.toThrow(/secrets/u);
        await expect(
            readWorkspaceFile(getDb(), { agentId: 'planner', path: 'secret-link.md' })
        ).rejects.toThrow(/inside the workspace/u);
    });
});
