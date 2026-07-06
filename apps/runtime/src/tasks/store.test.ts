import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { closeDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import { upsertStoredAgent } from '../tavern/agents-store.ts';
import { createTaskId } from './ids.ts';
import {
    createTask,
    deleteTask,
    getTask,
    getTaskByNumber,
    listTasks,
    updateTask,
} from './store.ts';

describe('tasks store', () => {
    beforeEach(() => {
        ensureRuntimeSchema(initTestDb());
        storeTestAgent('agt_primary');
    });

    afterEach(() => {
        closeDb();
    });

    test('assigns sequential T-numbers starting at 1', () => {
        const first = createTask({ id: createTaskId(), title: 'First task' });
        const second = createTask({ id: createTaskId(), title: 'Second task' });

        expect(first.number).toBe(1);
        expect(second.number).toBe(2);
        expect(getTaskByNumber(2)?.id).toBe(second.id);
    });

    test('keeps numbers unique after deletes', () => {
        createTask({ id: createTaskId(), title: 'First task' });
        const second = createTask({ id: createTaskId(), title: 'Second task' });
        deleteTask(second.id);
        const third = createTask({ id: createTaskId(), title: 'Third task' });

        expect(third.number).toBe(2);
        expect(listTasks().map((task) => task.number)).toEqual([2, 1]);
    });

    test('creates with defaults and round-trips all fields', () => {
        const created = createTask({ id: createTaskId(), title: 'Defaults' });
        expect(created).toMatchObject({
            assignee: null,
            description: null,
            epicId: null,
            kind: 'task',
            labels: [],
            priority: 'none',
            status: 'backlog',
        });

        const updated = updateTask(created.id, {
            assignee: { agentId: 'agt_primary', kind: 'agent' },
            description: 'Longer body',
            labels: ['bug', 'ui'],
            priority: 'high',
            status: 'in_progress',
            title: 'Renamed',
        });
        expect(updated).toMatchObject({
            assignee: { agentId: 'agt_primary', kind: 'agent' },
            description: 'Longer body',
            labels: ['bug', 'ui'],
            priority: 'high',
            status: 'in_progress',
            title: 'Renamed',
        });

        const cleared = updateTask(created.id, { assignee: null });
        expect(cleared?.assignee).toBeNull();
    });

    test('links tasks to epics and clears the link when the epic is deleted', () => {
        const epic = createTask({ id: createTaskId(), kind: 'epic', title: 'Big push' });
        const task = createTask({ epicId: epic.id, id: createTaskId(), title: 'Step one' });
        expect(task.epicId).toBe(epic.id);
        expect(listTasks({ epicId: epic.id })).toHaveLength(1);

        deleteTask(epic.id);
        expect(getTask(task.id)?.epicId).toBeNull();
    });

    test('rejects linking to a non-epic parent', () => {
        const plain = createTask({ id: createTaskId(), title: 'Not an epic' });
        expect(() => createTask({ epicId: plain.id, id: createTaskId(), title: 'Child' })).toThrow(
            'is not an epic'
        );
    });

    test('filters by status and kind', () => {
        createTask({ id: createTaskId(), status: 'todo', title: 'Todo item' });
        createTask({ id: createTaskId(), status: 'done', title: 'Done item' });
        createTask({ id: createTaskId(), kind: 'epic', title: 'Epic item' });

        expect(listTasks({ status: 'todo' })).toHaveLength(1);
        expect(listTasks({ kind: 'epic' })).toHaveLength(1);
        expect(listTasks()).toHaveLength(3);
    });

    test('returns null when updating a missing task', () => {
        expect(updateTask('tsk_missing', { title: 'Nope' })).toBeNull();
        expect(deleteTask('tsk_missing')).toBe(false);
    });
});

function storeTestAgent(agentId: string) {
    upsertStoredAgent({
        agent: {
            enabledSkillIds: [],
            id: agentId,
            isAdmin: false,
            name: agentId,
            primaryColor: null,
            workspaceFolder: `/tmp/${agentId}`,
        },
    });
}
