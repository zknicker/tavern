import { afterEach, expect, mock, spyOn, test } from 'bun:test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const directory = mkdtempSync(join(tmpdir(), 'tavern-tasks-list-'));
const databasePath = join(directory, 'test.sqlite');

process.env.DATABASE_PATH = databasePath;

const [
    { ensureDatabaseSchema },
    { databaseClient },
    { saveTaskRecord },
    agentRuntimeSync,
    { getTask, listTasks },
] = await Promise.all([
    import('../db/bootstrap.ts'),
    import('../db/index.ts'),
    import('../storage/tasks.ts'),
    import('../sync/agent-runtime-sync.ts'),
    import('./list.ts'),
]);

ensureDatabaseSchema();

afterEach(() => {
    mock.restore();
    databaseClient.exec('DELETE FROM tasks;');
});

function buildTask(overrides: Partial<Record<string, unknown>> = {}) {
    return {
        activeDispatchRunId: null,
        assignee: null,
        attachments: [],
        blockedBy: [],
        blockedReason: null,
        createdAt: '2026-07-01T13:00:00.000Z',
        description: 'Fix the invite email link.',
        dispatchAttempts: 0,
        dispatchTrigger: null,
        epicId: null,
        id: 'tsk_1',
        kind: 'task' as const,
        labels: [{ color: 'red' as const, id: 'lbl_bug', name: 'bug' }],
        number: 1,
        priority: 'high' as const,
        scheduledFor: null,
        status: 'backlog' as const,
        summary: null,
        title: 'Fix invite link',
        updatedAt: '2026-07-02T13:00:00.000Z',
        workChatId: null,
        ...overrides,
    };
}

test('listTasks returns mirrored tasks ordered by number descending', async () => {
    spyOn(agentRuntimeSync, 'syncAgentRuntimeTasks').mockImplementation(async () => []);
    await saveTaskRecord({
        runtimeId: 'runtime-1',
        task: buildTask({
            attachments: [
                {
                    byteSize: 11,
                    filename: 'result.txt',
                    id: 'att_1',
                    mediaType: 'text/plain',
                    promotedAt: '2026-07-02T12:00:00.000Z',
                    sourcePath: 'workbench/tasks/T-1/result.txt',
                },
            ],
        }),
    });
    await saveTaskRecord({
        runtimeId: 'runtime-1',
        task: buildTask({
            blockedBy: ['tsk_1'],
            blockedReason: { kind: 'error', message: 'Runtime failed.' },
            id: 'tsk_2',
            number: 2,
            scheduledFor: '2026-07-20',
            status: 'blocked',
            summary: 'Stopped after runtime failure.',
            title: 'Second',
        }),
    });

    const result = await listTasks();

    expect(result.tasks.map((task) => task.number)).toEqual([2, 1]);
    expect(result.tasks[1]).toMatchObject({
        attachments: [{ filename: 'result.txt', id: 'att_1' }],
        id: 'tsk_1',
        labels: [{ color: 'red', id: 'lbl_bug', name: 'bug' }],
        priority: 'high',
        title: 'Fix invite link',
    });
    expect(result.tasks[0]).toMatchObject({
        blockedBy: ['tsk_1'],
        blockedReason: { kind: 'error', message: 'Runtime failed.' },
        scheduledFor: '2026-07-20',
        status: 'blocked',
        summary: 'Stopped after runtime failure.',
    });
});

test('getTask returns the mirrored record or null', async () => {
    spyOn(agentRuntimeSync, 'syncAgentRuntimeTasks').mockImplementation(async () => []);
    await saveTaskRecord({
        runtimeId: 'runtime-1',
        task: buildTask({
            attachments: [
                {
                    byteSize: 11,
                    filename: 'result.txt',
                    id: 'att_1',
                    mediaType: 'text/plain',
                    promotedAt: '2026-07-02T12:00:00.000Z',
                    sourcePath: 'workbench/tasks/T-1/result.txt',
                },
            ],
        }),
    });

    const found = await getTask({ taskId: 'tsk_1' });
    expect(found.task?.title).toBe('Fix invite link');
    expect(found.task?.attachments[0]?.filename).toBe('result.txt');

    const missing = await getTask({ taskId: 'tsk_missing' });
    expect(missing.task).toBeNull();
});
