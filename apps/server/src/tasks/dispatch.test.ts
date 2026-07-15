import { afterEach, mock, spyOn, test } from 'bun:test';
import assert from 'node:assert/strict';

const [invalidationEvents, taskStorage, taskMutations, { dispatchTask }] = await Promise.all([
    import('../api/invalidation-events.ts'),
    import('../storage/tasks.ts'),
    import('./mutations.ts'),
    import('./dispatch.ts'),
]);

afterEach(() => mock.restore());

test('manual dispatch delegates claim, work chat, and send to Runtime', async () => {
    const task = {
        activeDispatchRunId: 'run_1',
        assignee: { agentId: 'agt_primary', kind: 'agent' as const },
        attachments: [],
        blockedBy: [],
        blockedReason: null,
        createdAt: '2026-07-09T12:00:00.000Z',
        description: 'Implement dispatch.',
        dispatchAttempts: 1,
        dispatchTrigger: 'manual' as const,
        epicId: null,
        id: 'tsk_1',
        kind: 'task' as const,
        labels: [],
        number: 12,
        originChatId: 'cht_origin',
        priority: 'high' as const,
        scheduledFor: null,
        status: 'in_progress' as const,
        summary: null,
        title: 'Fix dispatch',
        updatedAt: '2026-07-09T12:01:00.000Z',
        workChatId: 'cht_task',
    };
    const runtimeClient = {
        dispatchTask: mock(async () => ({ chatId: 'cht_task', task })),
    };
    spyOn(taskMutations, 'requireActiveTaskRuntime').mockResolvedValue({
        client: runtimeClient as never,
        runtimeId: 'runtime-1',
    });
    const save = spyOn(taskStorage, 'saveTaskRecord').mockResolvedValue('tsk_1');
    spyOn(invalidationEvents, 'emitTasksUpdated').mockImplementation(() => undefined);

    const result = await dispatchTask({ agentId: 'agt_primary', taskId: 'tsk_1' });

    assert.equal(result.task.activeDispatchRunId, 'run_1');
    assert.deepEqual(runtimeClient.dispatchTask.mock.calls, [['tsk_1', 'agt_primary']]);
    assert.deepEqual(save.mock.calls[0], [{ runtimeId: 'runtime-1', task }]);
});
