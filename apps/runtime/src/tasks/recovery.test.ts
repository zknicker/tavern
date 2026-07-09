import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { closeDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import { upsertStoredAgent } from '../tavern/agents-store.ts';
import { claimTaskDispatch, isTaskDispatchRun, recordTaskDispatchRun } from './dispatch-store.ts';
import { recoverSettledTaskDispatches, recoverTaskDispatchForTurn } from './recovery.ts';
import { createTask, getTask, updateTask } from './store.ts';

describe('task dispatch recovery', () => {
    beforeEach(() => {
        ensureRuntimeSchema(initTestDb());
        upsertStoredAgent({
            agent: {
                enabledSkillIds: [],
                id: 'agt_primary',
                isAdmin: false,
                name: 'Primary',
                primaryColor: null,
                workspaceFolder: '/tmp/agt_primary',
            },
        });
    });

    afterEach(() => closeDb());

    test('protocol violation requeues attempt one and blocks attempt two', () => {
        const task = createQueuedTask('tsk_protocol');
        claimAndRecord(task.id, task.updatedAt, 'run_1');
        recoverTaskDispatchForTurn('run_1', { status: 'completed' });
        const retried = getTask(task.id);
        expect(retried).toMatchObject({
            activeDispatchRunId: null,
            dispatchAttempts: 1,
            status: 'todo',
        });

        claimAndRecord(task.id, retried?.updatedAt ?? '', 'run_2');
        recoverTaskDispatchForTurn('run_2', { status: 'completed' });
        expect(getTask(task.id)).toMatchObject({
            activeDispatchRunId: null,
            blockedReason: {
                kind: 'error',
                message:
                    'Protocol violation: dispatched turn completed while the task was still in_progress.',
            },
            dispatchAttempts: 2,
            status: 'blocked',
        });
    });

    test('user stop blocks for input without treating it as a failed attempt', () => {
        const task = createQueuedTask('tsk_stop');
        claimAndRecord(task.id, task.updatedAt, 'run_stop');
        recoverTaskDispatchForTurn('run_stop', { status: 'cancelled' });
        expect(getTask(task.id)).toMatchObject({
            activeDispatchRunId: null,
            blockedReason: { kind: 'needs_input', message: 'Stopped by user.' },
            dispatchAttempts: 1,
            status: 'blocked',
        });
    });

    test('a human requeue into todo grants fresh dispatch attempts', () => {
        const task = createQueuedTask('tsk_fresh');
        claimAndRecord(task.id, task.updatedAt, 'run_a');
        recoverTaskDispatchForTurn('run_a', { status: 'completed' });
        const requeued = getTask(task.id);
        claimAndRecord(task.id, requeued?.updatedAt ?? '', 'run_b');
        recoverTaskDispatchForTurn('run_b', { status: 'completed' });
        expect(getTask(task.id)?.status).toBe('blocked');

        // The user resolves the failure and promotes the task again.
        const promoted = updateTask(task.id, { status: 'todo' });
        expect(promoted).toMatchObject({ dispatchAttempts: 0, status: 'todo' });

        // The next failure requeues instead of blocking immediately.
        claimAndRecord(task.id, promoted?.updatedAt ?? '', 'run_c');
        recoverTaskDispatchForTurn('run_c', { status: 'completed' });
        expect(getTask(task.id)).toMatchObject({ dispatchAttempts: 1, status: 'todo' });
    });

    test('identifies live dispatch runs for the longer turn watchdog', () => {
        const task = createQueuedTask('tsk_watchdog');
        expect(isTaskDispatchRun('run_watchdog')).toBe(false);
        claimAndRecord(task.id, task.updatedAt, 'run_watchdog');
        expect(isTaskDispatchRun('run_watchdog')).toBe(true);
        recoverTaskDispatchForTurn('run_watchdog', { status: 'completed' });
        expect(isTaskDispatchRun('run_watchdog')).toBe(false);
    });

    test('startup recovery treats a recorded run with no turn as a crash', () => {
        const task = createQueuedTask('tsk_crash');
        claimAndRecord(task.id, task.updatedAt, 'run_missing');
        expect(recoverSettledTaskDispatches()).toBe(1);
        expect(getTask(task.id)).toMatchObject({
            activeDispatchRunId: null,
            dispatchAttempts: 1,
            status: 'todo',
        });
    });
});

function createQueuedTask(id: string) {
    return createTask({
        assignee: { agentId: 'agt_primary', kind: 'agent' },
        id,
        status: 'todo',
        title: 'Recover me',
    });
}

function claimAndRecord(taskId: string, updatedAt: string, runId: string) {
    expect(
        claimTaskDispatch({
            agentId: 'agt_primary',
            expectedUpdatedAt: updatedAt,
            taskId,
            trigger: 'auto',
        })
    ).not.toBeNull();
    expect(recordTaskDispatchRun({ runId, taskId })).not.toBeNull();
}
