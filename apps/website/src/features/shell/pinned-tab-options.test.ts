import { describe, expect, test } from 'bun:test';
import {
    getPinnedTabColorStyle,
    getPinnedTabColorTheme,
    pinnedTabColorOptions,
} from './pinned-tab-options.ts';

describe('pinned tab options', () => {
    test('offers unique hex color choices', () => {
        expect(pinnedTabColorOptions.length).toBeGreaterThanOrEqual(12);
        expect(new Set(pinnedTabColorOptions.map((option) => option.id)).size).toBe(
            pinnedTabColorOptions.length
        );
        expect(pinnedTabColorOptions.every((option) => /^#[0-9a-f]{6}$/u.test(option.value))).toBe(
            true
        );
        expect(
            pinnedTabColorOptions.every((option) => /^#[0-9a-f]{6}$/u.test(option.lightValue))
        ).toBe(true);
        expect(
            pinnedTabColorOptions.every((option) => /^#[0-9a-f]{6}$/u.test(option.darkValue))
        ).toBe(true);
    });

    test('resolves theme colors case-insensitively', () => {
        expect(getPinnedTabColorTheme('#22C55E')).toEqual({
            darkValue: '#4ade80',
            lightValue: '#16a34a',
        });
    });

    test('builds visible style vars for a selected color', () => {
        expect(getPinnedTabColorStyle('#22c55e')).toEqual(
            expect.objectContaining({
                '--pinned-tab-bg-active-light': 'color-mix(in srgb, #16a34a 20%, transparent)',
                '--pinned-tab-color-dark': '#4ade80',
                '--pinned-tab-color-light': '#16a34a',
            })
        );
        expect(getPinnedTabColorStyle(null)).toBeUndefined();
    });
});
