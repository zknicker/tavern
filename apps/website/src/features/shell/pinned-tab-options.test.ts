import { describe, expect, test } from 'bun:test';
import { pinnedTabColorOptions } from './pinned-tab-options.ts';

describe('pinned tab options', () => {
    test('offers unique hex color choices', () => {
        expect(pinnedTabColorOptions.length).toBeGreaterThanOrEqual(12);
        expect(new Set(pinnedTabColorOptions.map((option) => option.id)).size).toBe(
            pinnedTabColorOptions.length
        );
        expect(pinnedTabColorOptions.every((option) => /^#[0-9a-f]{6}$/u.test(option.value))).toBe(
            true
        );
    });
});
