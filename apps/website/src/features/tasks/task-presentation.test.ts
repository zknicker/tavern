import { describe, expect, test } from 'bun:test';
import type { TaskListItem } from '../../lib/trpc.tsx';
import {
    filterTasks,
    formatTaskNumber,
    groupTasksByStatus,
    type TaskRecord,
    taskStatusClasses,
    taskStatusLabels,
    taskStatusOrder,
    toTaskRecord,
} from './task-presentation.ts';

describe('task presentation', () => {
    test('maps the five Raft statuses to their labels and colors', () => {
        expect(taskStatusOrder).toEqual(['todo', 'in_progress', 'in_review', 'done', 'closed']);
        expect(taskStatusLabels).toEqual({
            closed: 'Closed',
            done: 'Done',
            in_progress: 'In progress',
            in_review: 'In review',
            todo: 'Todo',
        });
        // todo→orange, in_progress→blue, in_review→purple, done→green, closed→gray.
        expect(taskStatusClasses.todo).toContain('orange');
        expect(taskStatusClasses.in_progress).toContain('blue');
        expect(taskStatusClasses.in_review).toContain('purple');
        expect(taskStatusClasses.done).toContain('green');
        expect(taskStatusClasses.closed).toContain('gray');
    });

    test('adapts a task-message into a row, per-conversation number verbatim title', () => {
        const row = toTaskRecord(
            makeItem({
                assignee: { handle: 'Ada', id: 'agt_ada' },
                number: 7,
                status: 'in_review',
                title: 'Fix the invite flow',
            })
        );
        expect(formatTaskNumber(row)).toBe('#7');
        expect(row.title).toBe('Fix the invite flow');
        expect(row.assignee).toEqual({ agentId: 'agt_ada', kind: 'agent' });
    });

    test('the human operator maps to the user assignee', () => {
        expect(
            toTaskRecord(makeItem({ assignee: { handle: null, id: 'usr_tavern' } })).assignee
        ).toEqual({ kind: 'user' });
    });

    test('groups by status, keeping only populated groups in order', () => {
        const rows = [
            toTaskRecord(makeItem({ number: 1, status: 'in_review' })),
            toTaskRecord(makeItem({ number: 2, status: 'todo' })),
        ];
        expect(groupTasksByStatus(rows).map((group) => [group.status, group.tasks.length])).toEqual(
            [
                ['todo', 1],
                ['in_review', 1],
            ]
        );
    });

    test('composes view, assignee, label, and text filters', () => {
        const match = toTaskRecord(
            makeItem({
                assignee: { handle: 'Ada', id: 'agt_ada' },
                labels: [{ color: 'red', id: 'lbl_bug', name: 'Bug' }],
                status: 'in_progress',
                title: 'Fix invite flow',
            })
        );
        const other = toTaskRecord(makeItem({ number: 2, status: 'todo' }));
        expect(
            filterTasks({
                assignee: 'agent:agt_ada',
                label: 'lbl_bug',
                query: 'invite',
                tasks: [match, other],
                view: 'active',
            })
        ).toEqual([match]);
        // "My tasks" excludes agent-assigned rows.
        expect(
            filterTasks({
                assignee: 'anyone',
                label: 'all',
                query: '',
                tasks: [match],
                view: 'mine',
            })
        ).toEqual([]);
    });
});

function makeItem(
    input: {
        assignee?: TaskListItem['task']['assignee'];
        labels?: TaskListItem['task']['labels'];
        number?: number;
        status?: TaskListItem['task']['status'];
        title?: string;
    } = {}
): TaskListItem {
    const now = '2026-07-22T12:00:00.000Z';
    return {
        chat_id: 'cht_current',
        chat_kind: 'channel',
        chat_title: 'General',
        message: {
            attachments: [],
            author: { id: 'usr_tavern', kind: 'user', label: 'You', metadata: {} },
            chat_id: 'cht_current',
            content: input.title ?? 'Task',
            created_at: now,
            deleted_at: null,
            delivery_id: null,
            id: `msg_${input.number ?? 1}`,
            metadata: {},
            nonce: null,
            role: 'user',
            sequence: 1,
        },
        task: {
            assignee: input.assignee ?? null,
            claimed_at: null,
            created_at: now,
            labels: input.labels ?? [],
            number: input.number ?? 1,
            origin: 'converted',
            priority: 'none',
            status: input.status ?? 'todo',
            updated_at: now,
        },
    };
}

// Exercise the exported row type so an unused-import lint never masks a drift.
const _row: TaskRecord | null = null;
void _row;
