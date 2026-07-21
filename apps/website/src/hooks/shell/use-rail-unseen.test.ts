import { describe, expect, test } from 'bun:test';
import {
    buildTaskSeenRevisions,
    hasUnseenTasks,
    parseTaskSeenRevisions,
} from './rail-unseen-store.ts';

describe('tasks rail seen revisions', () => {
    test('parses persisted revisions and rejects invalid values', () => {
        const revisions = [{ id: 'task-1', updatedAt: '2026-07-21T12:00:00.000Z' }];

        expect(parseTaskSeenRevisions(JSON.stringify(revisions))).toEqual(revisions);
        expect(parseTaskSeenRevisions(null)).toEqual([]);
        expect(parseTaskSeenRevisions('not-json')).toEqual([]);
        expect(parseTaskSeenRevisions('{}')).toEqual([]);
    });

    test('reports new, changed, and late-arriving tasks', () => {
        const tasks = [{ id: 'task-1', updatedAt: '2026-07-21T12:00:00.000Z' }];
        const seen = buildTaskSeenRevisions(tasks);

        expect(hasUnseenTasks(tasks, seen)).toBe(false);
        expect(
            hasUnseenTasks([{ id: 'task-1', updatedAt: '2026-07-21T12:01:00.000Z' }], seen)
        ).toBe(true);
        expect(
            hasUnseenTasks(
                [...tasks, { id: 'late-task', updatedAt: '2026-07-20T12:00:00.000Z' }],
                seen
            )
        ).toBe(true);
    });
});
