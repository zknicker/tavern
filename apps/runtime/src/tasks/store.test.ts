import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { closeDb, getDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import { upsertStoredAgent } from '../tavern/agents-store.ts';
import { createChat, getChat } from '../tavern/chat-api/index.ts';
import { createTaskId } from './ids.ts';
import {
    colorForLabelName,
    createLabel,
    deleteLabel,
    listLabels,
    resolveLabelNames,
    updateLabel,
} from './labels.ts';
import {
    createTask,
    deleteTask,
    getTask,
    getTaskByNumber,
    listTasks,
    setTaskWorkChat,
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
            blockedBy: [],
            blockedReason: null,
            description: null,
            epicId: null,
            kind: 'task',
            labels: [],
            originChatId: null,
            priority: 'none',
            scheduledFor: null,
            status: 'backlog',
            summary: null,
        });

        const updated = updateTask(created.id, {
            assignee: { agentId: 'agt_primary', kind: 'agent' },
            blockedReason: { kind: 'needs_input', message: 'Waiting on copy.' },
            description: 'Longer body',
            labels: ['bug', 'ui'],
            priority: 'high',
            status: 'blocked',
            summary: 'Paused until copy arrives.',
            title: 'Renamed',
        });
        expect(updated).toMatchObject({
            assignee: { agentId: 'agt_primary', kind: 'agent' },
            blockedReason: { kind: 'needs_input', message: 'Waiting on copy.' },
            description: 'Longer body',
            labels: [
                { color: colorForLabelName('bug'), name: 'bug' },
                { color: colorForLabelName('ui'), name: 'ui' },
            ],
            priority: 'high',
            status: 'blocked',
            summary: 'Paused until copy arrives.',
            title: 'Renamed',
        });

        const cleared = updateTask(created.id, {
            assignee: null,
            status: 'in_progress',
        });
        expect(cleared?.assignee).toBeNull();
        expect(cleared?.blockedReason).toBeNull();
    });

    test('allows direct blocked writes without a reason', () => {
        const created = createTask({
            id: createTaskId(),
            status: 'blocked',
            title: 'Human-blocked task',
        });

        expect(created).toMatchObject({
            blockedReason: null,
            status: 'blocked',
        });
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

    test('round-trips and clears scheduled dates', () => {
        const created = createTask({
            id: createTaskId(),
            scheduledFor: '2026-07-20',
            title: 'Follow up',
        });

        expect(getTask(created.id)?.scheduledFor).toBe('2026-07-20');
        expect(updateTask(created.id, { scheduledFor: null })?.scheduledFor).toBeNull();
    });

    test('sets work chat through the narrow store path', () => {
        createChat({ id: 'cht_task', kind: 'task' });
        const created = createTask({ id: createTaskId(), title: 'Needs a chat' });

        expect(created.workChatId).toBeNull();
        expect(setTaskWorkChat(created.id, 'cht_task')?.workChatId).toBe('cht_task');
        expect(getTask(created.id)?.workChatId).toBe('cht_task');
    });

    test('archives work chats on terminal transitions only', () => {
        createChat({
            id: 'cht_done',
            kind: 'task',
            metadata: { tavern: { archived: false } },
        });
        createChat({
            id: 'cht_cancel',
            kind: 'task',
            metadata: { tavern: { archived: false } },
        });
        const doneTask = createTask({ id: createTaskId(), title: 'Close done' });
        const cancelTask = createTask({ id: createTaskId(), title: 'Close canceled' });
        setTaskWorkChat(doneTask.id, 'cht_done');
        setTaskWorkChat(cancelTask.id, 'cht_cancel');

        updateTask(doneTask.id, { status: 'review' });
        expect(getChat('cht_done')?.metadata).toEqual({ tavern: { archived: false } });

        updateTask(doneTask.id, { status: 'done' });
        updateTask(cancelTask.id, { status: 'canceled' });

        expect(getChat('cht_done')?.metadata).toEqual({ tavern: { archived: true } });
        expect(getChat('cht_cancel')?.metadata).toEqual({ tavern: { archived: true } });
    });

    test('replaces blockedBy as a set on update', () => {
        const first = createTask({ id: createTaskId(), title: 'First dependency' });
        const second = createTask({ id: createTaskId(), title: 'Second dependency' });
        const third = createTask({ id: createTaskId(), title: 'Third dependency' });
        const target = createTask({
            blockedBy: [first.id, second.id],
            id: createTaskId(),
            title: 'Dependent',
        });

        expect(target.blockedBy).toEqual([first.id, second.id]);
        expect(updateTask(target.id, { blockedBy: [third.id] })?.blockedBy).toEqual([third.id]);
    });

    test('resolves labels by name, dedupes case-insensitively, and replaces as a set', () => {
        const task = createTask({
            id: createTaskId(),
            labels: ['Bug', 'bug', 'UI'],
            title: 'Labeled work',
        });

        expect(task.labels.map((label) => label.name)).toEqual(['Bug', 'UI']);
        expect(listLabels()).toMatchObject([
            { color: colorForLabelName('Bug'), name: 'Bug', taskCount: 1 },
            { color: colorForLabelName('UI'), name: 'UI', taskCount: 1 },
        ]);

        const updated = updateTask(task.id, { labels: ['Docs'] });
        expect(updated?.labels.map((label) => label.name)).toEqual(['Docs']);
        expect(listLabels().map((label) => [label.name, label.taskCount])).toEqual([
            ['Bug', 0],
            ['Docs', 1],
            ['UI', 0],
        ]);
    });

    test('manages label records and cascades deletes off tasks', () => {
        const label = createLabel({ color: 'red', name: 'Ops' });
        const task = createTask({
            id: createTaskId(),
            labels: ['ops'],
            title: 'Operational work',
        });

        expect(task.labels).toEqual([label]);
        expect(() => createLabel({ name: ' OPS ' })).toThrow('already exists');
        expect(updateLabel(label.id, { color: 'blue', name: 'Platform' })).toMatchObject({
            color: 'blue',
            id: label.id,
            name: 'Platform',
        });
        expect(getTask(task.id)?.labels).toMatchObject([
            { color: 'blue', id: label.id, name: 'Platform' },
        ]);

        expect(deleteLabel(label.id)).toBe(true);
        expect(getTask(task.id)?.labels).toEqual([]);
    });

    test('resolveLabelNames creates missing labels once', () => {
        const ids = resolveLabelNames(['Data', 'data', 'Ops']);
        const again = resolveLabelNames(['DATA']);

        expect(ids).toHaveLength(2);
        expect(again).toEqual([ids[0]]);
        expect(colorForLabelName('Data')).toBe(colorForLabelName('data'));
        expect(listLabels().map((label) => label.name)).toEqual(['Data', 'Ops']);
    });

    test('rejects self dependencies', () => {
        const task = createTask({ id: createTaskId(), title: 'Self dependency' });

        expect(() => updateTask(task.id, { blockedBy: [task.id] })).toThrow(
            'A task cannot depend on itself.'
        );
    });

    test('rejects epic dependency endpoints', () => {
        const epic = createTask({ id: createTaskId(), kind: 'epic', title: 'Epic' });
        const task = createTask({ id: createTaskId(), title: 'Task' });

        expect(() => updateTask(epic.id, { blockedBy: [task.id] })).toThrow(
            'is an epic and cannot have dependencies'
        );
        expect(() => updateTask(task.id, { blockedBy: [epic.id] })).toThrow(
            'is an epic and cannot be a dependency'
        );
    });

    test('rejects unknown dependency ids', () => {
        const task = createTask({ id: createTaskId(), title: 'Known task' });

        expect(() => updateTask(task.id, { blockedBy: ['tsk_missing'] })).toThrow(
            'Missing dependency task tsk_missing.'
        );
    });

    test('rejects direct dependency cycles by T-number path', () => {
        const first = createTask({ id: createTaskId(), title: 'First' });
        const second = createTask({ blockedBy: [first.id], id: createTaskId(), title: 'Second' });

        expect(() => updateTask(first.id, { blockedBy: [second.id] })).toThrow(
            'Dependency cycle rejected: T-1 -> T-2 -> T-1.'
        );
    });

    test('rejects transitive dependency cycles by T-number path', () => {
        const first = createTask({ id: createTaskId(), title: 'First' });
        const second = createTask({ blockedBy: [first.id], id: createTaskId(), title: 'Second' });
        const third = createTask({ blockedBy: [second.id], id: createTaskId(), title: 'Third' });

        expect(() => updateTask(first.id, { blockedBy: [third.id] })).toThrow(
            'Dependency cycle rejected: T-1 -> T-3 -> T-2 -> T-1.'
        );
    });

    test('cascades deleted dependency edges', () => {
        const dependency = createTask({ id: createTaskId(), title: 'Dependency' });
        const dependent = createTask({
            blockedBy: [dependency.id],
            id: createTaskId(),
            title: 'Dependent',
        });
        const otherDependency = createTask({ id: createTaskId(), title: 'Other dependency' });
        const otherDependent = createTask({
            blockedBy: [otherDependency.id],
            id: createTaskId(),
            title: 'Other dependent',
        });

        deleteTask(dependency.id);
        deleteTask(otherDependent.id);

        expect(getTask(dependent.id)?.blockedBy).toEqual([]);
        expect(getDependencyEdgeCount()).toBe(0);
    });

    test('lists dependency edges for multiple tasks', () => {
        const first = createTask({ id: createTaskId(), title: 'First dependency' });
        const second = createTask({ id: createTaskId(), title: 'Second dependency' });
        const third = createTask({ blockedBy: [first.id], id: createTaskId(), title: 'Third' });
        const fourth = createTask({
            blockedBy: [first.id, second.id],
            id: createTaskId(),
            title: 'Fourth',
        });

        const tasks = new Map(listTasks().map((task) => [task.id, task.blockedBy]));
        expect(tasks.get(third.id)).toEqual([first.id]);
        expect(tasks.get(fourth.id)).toEqual([first.id, second.id]);
    });

    test('filters by status and kind', () => {
        createTask({ id: createTaskId(), status: 'todo', title: 'Todo item' });
        createTask({ id: createTaskId(), status: 'review', title: 'Review item' });
        createTask({ id: createTaskId(), kind: 'epic', title: 'Epic item' });

        expect(listTasks({ status: 'todo' })).toHaveLength(1);
        expect(listTasks({ status: 'review' })).toHaveLength(1);
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

function getDependencyEdgeCount() {
    return (
        getDb().prepare('SELECT COUNT(*) AS count FROM task_dependencies').get() as {
            count: number;
        }
    ).count;
}
