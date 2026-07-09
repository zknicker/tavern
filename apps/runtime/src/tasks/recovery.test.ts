import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { closeDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import { upsertStoredAgent } from '../tavern/agents-store.ts';
import { createChat, listMessages } from '../tavern/chat-api/index.ts';
import { claimTaskDispatch, isTaskDispatchRun, recordTaskDispatchRun } from './dispatch-store.ts';
import { recoverSettledTaskDispatches, recoverTaskDispatchForTurn } from './recovery.ts';
import { createTask, getTask, setTaskWorkChat, updateTask } from './store.ts';

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

    test('notifies an originating chat once with only the summary first line', () => {
        createChat({ id: 'cht_origin' });
        createChat({ id: 'cht_work', kind: 'task' });
        const task = createQueuedTask('tsk_notify', 'cht_origin');
        setTaskWorkChat(task.id, 'cht_work');
        claimAndRecord(task.id, getTask(task.id)?.updatedAt ?? '', 'run_notify');
        updateTask(task.id, {
            status: 'done',
            summary: 'Shipped the fix.\nInternal detail stays on the task.',
        });

        recoverTaskDispatchForTurn('run_notify', { status: 'completed' });
        recoverTaskDispatchForTurn('run_notify', { status: 'completed' });

        expect(listMessages('cht_origin').messages).toMatchObject([
            {
                author: { id: 'agt_primary', kind: 'agent' },
                content: 'T-1 is done: Shipped the fix.',
                role: 'assistant',
            },
        ]);
    });

    test('uses blocked reason kind and first line in the notification', () => {
        createChat({ id: 'cht_blocked_origin' });
        const task = createQueuedTask('tsk_blocked_notify', 'cht_blocked_origin');
        claimAndRecord(task.id, task.updatedAt, 'run_blocked');
        updateTask(task.id, {
            blockedReason: {
                kind: 'needs_input',
                message: 'Choose a launch date.\nThe alternatives remain on the task.',
            },
            status: 'blocked',
        });

        recoverTaskDispatchForTurn('run_blocked', { status: 'completed' });

        expect(listMessages('cht_blocked_origin').messages[0]?.content).toBe(
            'T-1 is blocked (needs input): Choose a launch date.'
        );
    });

    test('suppresses notifications without a distinct origin or an auto dispatch', () => {
        createChat({ id: 'cht_same', kind: 'task' });
        const sameChat = createQueuedTask('tsk_same', 'cht_same');
        setTaskWorkChat(sameChat.id, 'cht_same');
        claimAndRecord(sameChat.id, getTask(sameChat.id)?.updatedAt ?? '', 'run_same');
        updateTask(sameChat.id, { status: 'review', summary: 'Ready for review.' });
        recoverTaskDispatchForTurn('run_same', { status: 'completed' });

        createChat({ id: 'cht_manual_origin' });
        const manual = createQueuedTask('tsk_manual', 'cht_manual_origin');
        claimAndRecord(manual.id, manual.updatedAt, 'run_manual', 'manual');
        updateTask(manual.id, { status: 'canceled', summary: 'No longer needed.' });
        recoverTaskDispatchForTurn('run_manual', { status: 'completed' });

        const missing = createQueuedTask('tsk_missing_origin');
        claimAndRecord(missing.id, missing.updatedAt, 'run_missing_origin');
        updateTask(missing.id, { status: 'done', summary: 'Finished quietly.' });
        recoverTaskDispatchForTurn('run_missing_origin', { status: 'completed' });

        expect(listMessages('cht_same').messages).toEqual([]);
        expect(listMessages('cht_manual_origin').messages).toEqual([]);
    });
});

function createQueuedTask(id: string, originChatId?: string) {
    return createTask(
        {
            assignee: { agentId: 'agt_primary', kind: 'agent' },
            id,
            status: 'todo',
            title: 'Recover me',
        },
        { originChatId }
    );
}

function claimAndRecord(
    taskId: string,
    updatedAt: string,
    runId: string,
    trigger: 'auto' | 'manual' = 'auto'
) {
    expect(
        claimTaskDispatch({
            agentId: 'agt_primary',
            expectedUpdatedAt: updatedAt,
            taskId,
            trigger,
        })
    ).not.toBeNull();
    expect(recordTaskDispatchRun({ runId, taskId })).not.toBeNull();
}
