import { describe, expect, test } from 'bun:test';
import type { TaskRecord } from '../../lib/trpc.tsx';
import { pickPlateTasks } from './overview-plate.ts';

function makeTask(overrides: Partial<TaskRecord>): TaskRecord {
    return {
        assignee: null,
        number: 1,
        status: 'todo',
        title: 'Task',
        ...overrides,
    } as TaskRecord;
}

describe('pickPlateTasks', () => {
    test('surfaces review and blocked work regardless of assignee', () => {
        const tasks = [
            makeTask({ number: 1, status: 'backlog' }),
            makeTask({ number: 2, status: 'review' }),
            makeTask({
                assignee: { agentId: 'agt_1', kind: 'agent' },
                number: 3,
                status: 'blocked',
            }),
            makeTask({ number: 4, status: 'done' }),
        ];

        expect(pickPlateTasks(tasks, 10).map((task) => task.number)).toEqual([2, 3]);
    });

    test('includes open user-owned tasks but not agent-owned ones', () => {
        const tasks = [
            makeTask({ assignee: { kind: 'user' }, number: 1, status: 'todo' }),
            makeTask({ assignee: { agentId: 'agt_1', kind: 'agent' }, number: 2, status: 'todo' }),
            makeTask({ assignee: null, number: 3, status: 'in_progress' }),
        ];

        expect(pickPlateTasks(tasks, 10).map((task) => task.number)).toEqual([1]);
    });

    test('orders review first, then blocked, then the rest', () => {
        const tasks = [
            makeTask({ assignee: { kind: 'user' }, number: 1, status: 'todo' }),
            makeTask({ number: 2, status: 'blocked' }),
            makeTask({ number: 3, status: 'review' }),
        ];

        expect(pickPlateTasks(tasks, 10).map((task) => task.number)).toEqual([3, 2, 1]);
    });

    test('respects the limit', () => {
        const tasks = [
            makeTask({ number: 1, status: 'review' }),
            makeTask({ number: 2, status: 'review' }),
            makeTask({ number: 3, status: 'review' }),
        ];

        expect(pickPlateTasks(tasks, 2)).toHaveLength(2);
    });
});
