import { expect, test } from 'bun:test';
import { shouldShowToolStatusBadge } from './tool-ui.ts';

test('completed tool rows do not show active result statuses as invocation badges', () => {
    expect(
        shouldShowToolStatusBadge({
            completedAt: '2026-05-09T20:41:23.000Z',
            status: 'RUNNING',
        })
    ).toBe(false);
});

test('unfinished tool rows still show active invocation badges', () => {
    expect(
        shouldShowToolStatusBadge({
            completedAt: null,
            status: 'RUNNING',
        })
    ).toBe(true);
});

test('completed tool rows still show terminal error badges', () => {
    expect(
        shouldShowToolStatusBadge({
            completedAt: '2026-05-09T20:41:23.000Z',
            status: 'error',
        })
    ).toBe(true);
});
