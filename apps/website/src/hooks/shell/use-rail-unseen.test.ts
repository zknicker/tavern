import { describe, expect, test } from 'bun:test';
import { hasTasksUpdatedAfter, parseTasksLastSeenAt } from './rail-unseen-store.ts';

describe('tasks rail watermark', () => {
    test('parses persisted timestamps and rejects invalid values', () => {
        expect(parseTasksLastSeenAt('1720000000000')).toBe(1_720_000_000_000);
        expect(parseTasksLastSeenAt(null)).toBe(0);
        expect(parseTasksLastSeenAt('not-a-time')).toBe(0);
    });

    test('reports tasks updated after the watermark', () => {
        const tasks = [
            { updatedAt: '2026-07-20T12:00:00.000Z' },
            { updatedAt: '2026-07-21T12:00:00.000Z' },
        ];

        expect(hasTasksUpdatedAfter(tasks, Date.parse('2026-07-21T11:59:59.000Z'))).toBe(true);
        expect(hasTasksUpdatedAfter(tasks, Date.parse('2026-07-21T12:00:00.000Z'))).toBe(false);
        expect(hasTasksUpdatedAfter([{ updatedAt: 'invalid' }], 0)).toBe(false);
    });
});
