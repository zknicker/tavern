import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { closeDb, getDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import { upsertStoredAgent } from '../tavern/agents-store.ts';
import {
    deleteTaskAttachment,
    materializeTaskAttachments,
    promoteTaskAttachments,
    readTaskAttachment,
} from './attachments.ts';
import { createTask, deleteTask, getTask } from './store.ts';

describe('task attachments', () => {
    let artifactsRoot: string;
    let tempRoot: string;
    let workspace: string;
    const originalArtifactsRoot = process.env.TAVERN_TASK_ARTIFACTS_DIR;

    beforeEach(async () => {
        tempRoot = await fs.mkdtemp(path.join(tmpdir(), 'tavern-task-attachments-'));
        artifactsRoot = path.join(tempRoot, 'artifacts');
        workspace = path.join(tempRoot, 'workspace');
        process.env.TAVERN_TASK_ARTIFACTS_DIR = artifactsRoot;
        await fs.mkdir(workspace, { recursive: true });
        ensureRuntimeSchema(initTestDb());
        storeAgent('agt_primary', workspace);
    });

    afterEach(async () => {
        closeDb();
        restoreEnv('TAVERN_TASK_ARTIFACTS_DIR', originalArtifactsRoot);
        await fs.rm(tempRoot, { force: true, recursive: true });
    });

    test('promotes copies with metadata and replaces case-insensitively by filename', async () => {
        const task = createTask({ id: 'tsk_promote', title: 'Promote output' });
        await writeWorkspaceFile('draft/Report.md', 'first');

        const [first] = await promoteTaskAttachments({
            agentId: 'agt_primary',
            paths: ['draft/Report.md'],
            taskId: task.id,
        });
        expect(first).toMatchObject({
            byteSize: 5,
            filename: 'Report.md',
            mediaType: 'text/markdown',
            sourcePath: 'draft/Report.md',
        });
        expect(await fs.readFile(artifactPath(task.id, 'Report.md'), 'utf8')).toBe('first');

        await writeWorkspaceFile('final/report.MD', 'replacement');
        const [replaced] = await promoteTaskAttachments({
            agentId: 'agt_primary',
            paths: ['final/report.MD'],
            taskId: task.id,
        });
        expect(replaced).toMatchObject({
            byteSize: 11,
            filename: 'report.MD',
            id: first?.id,
            mediaType: 'text/markdown',
            sourcePath: 'final/report.MD',
        });
        expect(getTask(task.id)?.attachments).toEqual([replaced]);
        expect(await fs.readFile(artifactPath(task.id, 'report.MD'), 'utf8')).toBe('replacement');
        expect(await fs.readdir(path.join(artifactsRoot, 'tasks', task.id))).toEqual(['report.MD']);

        const content = await readTaskAttachment(task.id, replaced?.id ?? '');
        expect(content).toEqual({
            contentBase64: Buffer.from('replacement').toString('base64'),
            filename: 'report.MD',
            mediaType: 'text/markdown',
        });
    });

    test('uses null media type for unknown extensions', async () => {
        const task = createTask({ id: 'tsk_unknown', title: 'Unknown output' });
        await writeWorkspaceFile('output.custom', 'bytes');

        const [attachment] = await promoteTaskAttachments({
            agentId: 'agt_primary',
            paths: ['output.custom'],
            taskId: task.id,
        });
        expect(attachment?.mediaType).toBeNull();
    });

    test('rejects absolute, escaping, symlinked, and missing workspace paths', async () => {
        const task = createTask({ id: 'tsk_paths', title: 'Validate paths' });
        const outside = path.join(tempRoot, 'outside.txt');
        await fs.writeFile(outside, 'outside');
        await fs.symlink(outside, path.join(workspace, 'linked.txt'));

        await expect(promote(['/tmp/outside.txt'], task.id)).rejects.toThrow(
            'must be workspace-relative'
        );
        await expect(promote(['../outside.txt'], task.id)).rejects.toThrow(
            'must stay inside the workspace'
        );
        await expect(promote(['linked.txt'], task.id)).rejects.toThrow(
            'must stay inside the workspace'
        );
        await expect(promote(['missing.txt'], task.id)).rejects.toThrow(
            'Attachment source file does not exist: missing.txt'
        );
    });

    test('materializes current attachments into the task workbench and overwrites', async () => {
        const task = createTask({ id: 'tsk_materialize', title: 'Rework output' });
        await writeWorkspaceFile('output/design.png', 'promoted');
        await promote(['output/design.png'], task.id);
        const destination = path.join(workspace, 'workbench/tasks/T-1/design.png');
        await fs.mkdir(path.dirname(destination), { recursive: true });
        await fs.writeFile(destination, 'stale');

        const paths = await materializeTaskAttachments({
            agentId: 'agt_primary',
            taskId: task.id,
        });
        expect(paths).toEqual(['workbench/tasks/T-1/design.png']);
        expect(await fs.readFile(destination, 'utf8')).toBe('promoted');
    });

    test('task and attachment deletion remove promoted files and rows', async () => {
        const single = createTask({ id: 'tsk_single_delete', title: 'Delete one' });
        await writeWorkspaceFile('one.txt', 'one');
        const [attachment] = await promote(['one.txt'], single.id);
        expect(await deleteTaskAttachment(single.id, attachment?.id ?? '')).toBe(true);
        expect(getTask(single.id)?.attachments).toEqual([]);
        await expect(fs.stat(artifactPath(single.id, 'one.txt'))).rejects.toThrow();

        const whole = createTask({ id: 'tsk_task_delete', title: 'Delete task' });
        await writeWorkspaceFile('whole.txt', 'whole');
        await promote(['whole.txt'], whole.id);
        expect(deleteTask(whole.id)).toBe(true);
        expect(
            getDb()
                .prepare('SELECT COUNT(*) AS count FROM task_attachments WHERE task_id = ?')
                .get(whole.id)
        ).toEqual({ count: 0 });
        await expect(fs.stat(path.join(artifactsRoot, 'tasks', whole.id))).rejects.toThrow();
    });

    async function writeWorkspaceFile(relativePath: string, content: string) {
        const destination = path.join(workspace, ...relativePath.split('/'));
        await fs.mkdir(path.dirname(destination), { recursive: true });
        await fs.writeFile(destination, content);
    }

    function promote(paths: string[], taskId: string) {
        return promoteTaskAttachments({ agentId: 'agt_primary', paths, taskId });
    }

    function artifactPath(taskId: string, filename: string) {
        return path.join(artifactsRoot, 'tasks', taskId, filename);
    }
});

function storeAgent(id: string, workspaceFolder: string) {
    upsertStoredAgent({
        agent: {
            enabledSkillIds: [],
            id,
            isAdmin: false,
            name: id,
            primaryColor: null,
            workspaceFolder,
        },
    });
}

function restoreEnv(key: string, value: string | undefined) {
    if (value === undefined) {
        delete process.env[key];
    } else {
        process.env[key] = value;
    }
}
