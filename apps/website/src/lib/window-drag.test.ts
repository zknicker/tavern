import { describe, expect, test } from 'bun:test';
import { canStartWindowDrag } from './window-drag.ts';

function createTarget(matchesBlockedSelector: boolean) {
    return {
        closest(selector: string) {
            return matchesBlockedSelector && selector.length > 0 ? {} : null;
        },
    };
}

describe('canStartWindowDrag', () => {
    test('allows drag from plain header content', () => {
        expect(canStartWindowDrag(createTarget(false))).toBe(true);
    });

    test('blocks drag from excluded interactive regions', () => {
        expect(canStartWindowDrag(createTarget(true))).toBe(false);
    });

    test('blocks drag from tab controls', () => {
        const target = {
            closest(selector: string) {
                return selector.includes('[role="tab"]') ? {} : null;
            },
        };

        expect(canStartWindowDrag(target)).toBe(false);
    });

    test('allows drag when there is no target element', () => {
        expect(canStartWindowDrag(null)).toBe(true);
    });
});
