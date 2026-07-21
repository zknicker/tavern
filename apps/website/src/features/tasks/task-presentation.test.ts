import { describe, expect, test } from 'bun:test';
import type { TaskRecord } from '../../lib/trpc.tsx';
import { filterTasks } from './task-presentation.ts';

describe('filterTasks conversation filter', () => {
    test('keeps only tasks that originated in the pinned conversation', () => {
        const result = filterTasks({
            assignee: 'anyone',
            conversationId: 'cht_current',
            label: 'all',
            query: '',
            tasks: [
                makeTask({ id: 'tsk_current', originChatId: 'cht_current' }),
                makeTask({ id: 'tsk_other', originChatId: 'cht_other' }),
                makeTask({ id: 'tsk_none', originChatId: null }),
            ],
            view: 'all',
        });

        expect(result.map((task) => task.id)).toEqual(['tsk_current']);
    });

    test('composes the conversation predicate with existing filters', () => {
        const result = filterTasks({
            assignee: 'me',
            conversationId: 'cht_current',
            label: 'lbl_bug',
            query: 'invite',
            tasks: [
                makeTask({
                    assignee: { kind: 'user' },
                    id: 'tsk_match',
                    labels: [{ color: 'red', id: 'lbl_bug', name: 'Bug' }],
                    originChatId: 'cht_current',
                    title: 'Fix invite flow',
                }),
                makeTask({
                    assignee: { kind: 'user' },
                    id: 'tsk_wrong_label',
                    originChatId: 'cht_current',
                    title: 'Fix invite copy',
                }),
                makeTask({
                    assignee: { kind: 'user' },
                    id: 'tsk_wrong_chat',
                    labels: [{ color: 'red', id: 'lbl_bug', name: 'Bug' }],
                    originChatId: 'cht_other',
                    title: 'Fix invite API',
                }),
            ],
            view: 'all',
        });

        expect(result.map((task) => task.id)).toEqual(['tsk_match']);
    });
});

function makeTask(overrides: Partial<TaskRecord>): TaskRecord {
    return {
        assignee: null,
        description: null,
        id: 'tsk_1',
        kind: 'task',
        labels: [],
        number: 1,
        originChatId: null,
        status: 'todo',
        title: 'Task',
        ...overrides,
    } as TaskRecord;
}
