import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { closeDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import { upsertStoredAgent } from '../tavern/agents-store.ts';
import { createTavernTaskTools } from './agent-tools.ts';
import { createTaskId } from './ids.ts';
import { createTask, getTask } from './store.ts';

describe('tasks agent tools', () => {
    let tempRoot: string;
    const originalArtifactsRoot = process.env.TAVERN_TASK_ARTIFACTS_DIR;

    beforeEach(async () => {
        tempRoot = await fs.mkdtemp(path.join(tmpdir(), 'tavern-task-tools-'));
        process.env.TAVERN_TASK_ARTIFACTS_DIR = path.join(tempRoot, 'artifacts');
        ensureRuntimeSchema(initTestDb());
        await storeTestAgent('agt_primary', path.join(tempRoot, 'agt_primary'));
        await storeTestAgent('agt_other', path.join(tempRoot, 'agt_other'));
    });

    afterEach(async () => {
        closeDb();
        restoreEnv('TAVERN_TASK_ARTIFACTS_DIR', originalArtifactsRoot);
        await fs.rm(tempRoot, { force: true, recursive: true });
    });

    test('creates, lists, reads, and updates tasks', async () => {
        const tools = createTavernTaskTools({ agentId: 'agt_primary' });

        const created = await runTool<Record<string, unknown>, { task: ToolTask }>(
            tools,
            'tasks_create',
            {
                description: 'Fix the invite email link.',
                labels: ['Bug'],
                priority: 'high',
                title: 'Fix invite link',
            }
        );
        expect(created.task).toMatchObject({
            number: 'T-1',
            labels: ['Bug'],
            priority: 'high',
            status: 'backlog',
            title: 'Fix invite link',
        });

        const listed = await runTool<Record<string, unknown>, { tasks: ToolTask[] }>(
            tools,
            'tasks_list',
            {}
        );
        expect(listed.tasks).toHaveLength(1);

        const read = await runTool<Record<string, unknown>, { task: ToolTask }>(
            tools,
            'tasks_get',
            { number: 1 }
        );
        expect(read.task.description).toBe('Fix the invite email link.');

        const updated = await runTool<Record<string, unknown>, { task: ToolTask }>(
            tools,
            'tasks_update',
            {
                assignToMe: true,
                labels: ['Email'],
                number: 1,
                status: 'done',
                summary: 'Fixed invite link. Verified in tests. Nothing remains.',
            }
        );
        expect(updated.task).toMatchObject({
            assignee: { agentId: 'agt_primary', kind: 'agent' },
            labels: ['Email'],
            status: 'done',
            summary: 'Fixed invite link. Verified in tests. Nothing remains.',
        });
    });

    test('creates tasks in backlog and rejects a status input', async () => {
        const tools = createTavernTaskTools({ agentId: 'agt_primary' });

        const created = await runTool<Record<string, unknown>, { task: ToolTask }>(
            tools,
            'tasks_create',
            { title: 'Needs triage' }
        );
        expect(created.task.status).toBe('backlog');
        expect(getTask(created.task.id)?.status).toBe('backlog');

        await expect(
            runTool(tools, 'tasks_create', { status: 'todo', title: 'Sneaky queue jump' })
        ).rejects.toThrow(/unrecognized/i);
    });

    test('rejects agent updates that promote tasks to todo', async () => {
        const task = createTask({ id: createTaskId(), title: 'Queued by human only' });
        const tools = createTavernTaskTools({ agentId: 'agt_primary' });

        await expect(
            runTool(tools, 'tasks_update', { status: 'todo', taskId: task.id })
        ).rejects.toThrow('Only the user promotes tasks into todo.');
    });

    test('requires a reason when setting blocked', async () => {
        const task = createTask({ id: createTaskId(), title: 'Blocked work' });
        const tools = createTavernTaskTools({ agentId: 'agt_primary' });

        await expect(
            runTool(tools, 'tasks_update', { status: 'blocked', taskId: task.id })
        ).rejects.toThrow('Setting blocked requires blockedReasonKind and blockedReason.');

        const updated = await runTool<Record<string, unknown>, { task: ToolTask }>(
            tools,
            'tasks_update',
            {
                blockedReason: 'Missing API key.',
                blockedReasonKind: 'needs_input',
                status: 'blocked',
                taskId: task.id,
            }
        );

        expect(updated.task).toMatchObject({
            blockedReason: { kind: 'needs_input', message: 'Missing API key.' },
            status: 'blocked',
        });
    });

    test('requires a summary for close-out statuses', async () => {
        const task = createTask({ id: createTaskId(), title: 'Close me' });
        const tools = createTavernTaskTools({ agentId: 'agt_primary' });

        await expect(
            runTool(tools, 'tasks_update', { status: 'review', taskId: task.id })
        ).rejects.toThrow('Setting done, review, or canceled requires a summary.');

        const updated = await runTool<Record<string, unknown>, { task: ToolTask }>(
            tools,
            'tasks_update',
            {
                status: 'review',
                summary: 'Drafted the change. Verified with focused tests. Needs user review.',
                taskId: task.id,
            }
        );

        expect(updated.task).toMatchObject({
            status: 'review',
            summary: 'Drafted the change. Verified with focused tests. Needs user review.',
        });
        expect(getTask(task.id)?.description).toBeNull();
    });

    test('filters the list to tasks assigned to the executing agent', async () => {
        createTask({
            assignee: { agentId: 'agt_primary', kind: 'agent' },
            id: createTaskId(),
            title: 'Mine',
        });
        createTask({
            assignee: { agentId: 'agt_other', kind: 'agent' },
            id: createTaskId(),
            title: 'Someone else',
        });

        const tools = createTavernTaskTools({ agentId: 'agt_primary' });
        const listed = await runTool<Record<string, unknown>, { tasks: ToolTask[] }>(
            tools,
            'tasks_list',
            { assignedToMe: true }
        );
        expect(listed.tasks).toHaveLength(1);
        expect(listed.tasks[0]?.title).toBe('Mine');
    });

    test('maps blockedBy T-numbers and scheduledFor through create and update', async () => {
        createTask({ id: createTaskId(), title: 'First dependency' });
        createTask({ id: createTaskId(), title: 'Second dependency' });
        const tools = createTavernTaskTools({ agentId: 'agt_primary' });

        const created = await runTool<Record<string, unknown>, { task: ToolTask }>(
            tools,
            'tasks_create',
            {
                blockedBy: [1],
                scheduledFor: '2026-07-20',
                title: 'Ordered follow-up',
            }
        );
        expect(created.task).toMatchObject({
            blockedBy: ['T-1'],
            scheduledFor: '2026-07-20',
        });

        const updated = await runTool<Record<string, unknown>, { task: ToolTask }>(
            tools,
            'tasks_update',
            {
                blockedBy: [2],
                number: 3,
                scheduledFor: null,
            }
        );
        expect(updated.task).toMatchObject({
            blockedBy: ['T-2'],
            scheduledFor: null,
        });
        expect(getTask(created.task.id)).toMatchObject({
            scheduledFor: null,
        });
    });

    test('rejects unknown blockedBy T-numbers', async () => {
        const tools = createTavernTaskTools({ agentId: 'agt_primary' });

        await expect(
            runTool(tools, 'tasks_create', { blockedBy: [7], title: 'Unknown dependency' })
        ).rejects.toThrow('Unknown blockedBy T-7.');
    });

    test('rejects reads without a task reference and publishes updates that persist', async () => {
        const tools = createTavernTaskTools({ agentId: 'agt_primary' });
        await expect(runTool(tools, 'tasks_get', {})).rejects.toThrow();

        const created = await runTool<Record<string, unknown>, { task: ToolTask }>(
            tools,
            'tasks_create',
            { title: 'Persist me' }
        );
        expect(getTask(created.task.id)?.title).toBe('Persist me');
    });

    test('attaches deliverables end-to-end while in progress', async () => {
        const task = createTask({ id: createTaskId(), status: 'in_progress', title: 'Ship file' });
        const relativePath = `workbench/tasks/T-${task.number}/result.txt`;
        const workspaceFile = path.join(tempRoot, 'agt_primary', ...relativePath.split('/'));
        await fs.mkdir(path.dirname(workspaceFile), { recursive: true });
        await fs.writeFile(workspaceFile, 'deliverable');
        const tools = createTavernTaskTools({ agentId: 'agt_primary' });

        const updated = await runTool<Record<string, unknown>, { task: ToolTask }>(
            tools,
            'tasks_update',
            { attachments: [relativePath], taskId: task.id }
        );
        expect(updated.task.attachments).toEqual(['result.txt']);
        expect(getTask(task.id)?.attachments).toMatchObject([
            { filename: 'result.txt', sourcePath: relativePath },
        ]);

        const closable = createTask({ id: createTaskId(), title: 'Close with output' });
        const closed = await runTool<Record<string, unknown>, { task: ToolTask }>(
            tools,
            'tasks_update',
            {
                attachments: [relativePath],
                status: 'review',
                summary: 'Attached the deliverable. Verified promotion. Ready for review.',
                taskId: closable.id,
            }
        );
        expect(closed.task).toMatchObject({ attachments: ['result.txt'], status: 'review' });

        const backlog = createTask({ id: createTaskId(), title: 'Not started' });
        await expect(
            runTool(tools, 'tasks_update', {
                attachments: [relativePath],
                taskId: backlog.id,
            })
        ).rejects.toThrow('Attachments require closing the task');
    });
});

async function storeTestAgent(agentId: string, workspaceFolder: string) {
    await fs.mkdir(workspaceFolder, { recursive: true });
    upsertStoredAgent({
        agent: {
            enabledSkillIds: [],
            id: agentId,
            isAdmin: false,
            name: agentId,
            primaryColor: null,
            workspaceFolder,
        },
    });
}

interface ToolTask {
    assignee: unknown;
    attachments?: string[];
    blockedBy?: string[];
    blockedReason?: unknown;
    description?: string | null;
    id: string;
    labels?: string[];
    number: string;
    priority: string;
    scheduledFor?: string | null;
    status: string;
    summary?: string | null;
    title: string;
}

function restoreEnv(key: string, value: string | undefined) {
    if (value === undefined) {
        delete process.env[key];
    } else {
        process.env[key] = value;
    }
}

type ToolName = keyof ReturnType<typeof createTavernTaskTools>;

async function runTool<Input, Output>(
    tools: ReturnType<typeof createTavernTaskTools>,
    name: ToolName,
    input: Input
): Promise<Output> {
    const selected = tools[name] as unknown as {
        execute: (
            input: Input,
            options: { context: unknown; messages: []; toolCallId: string }
        ) => Output | PromiseLike<Output>;
    };
    return await selected.execute(input, {
        context: undefined,
        messages: [],
        toolCallId: `call_${String(name)}`,
    });
}
